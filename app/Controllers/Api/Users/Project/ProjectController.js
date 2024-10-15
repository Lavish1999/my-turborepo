const { User, Organization,ProjectUsage, ProjectDomain,Invitation, OrganizationMember, App,Project, ProjectMember,ProjectIndex,ProjectSetting,ProjectKey,ProjectUrl,ProjectFile,UsageData,UsageLimit,sequelize,ChatbotIntegrationsSetting, ProjectText } = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
const { v4: uuidv4 } = require('uuid');
let { syncContactToChatBotList,updateBrevoContact } = require(baseDir() + "helper/syncContactToBrevo");
let { sendEmailNotification } = require(baseDir() + "helper/email");
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, getEmbeddingConfig, getQdrantConfig, getProject, validateParameters,getProjectData,  getIpDetail,userPrivilege,checkOrganizationLimit,increaseLimit,notifyOnDiscord,encrypt,decrypt, addToIndexQueue } = require(baseDir() + "helper/helper");
// let { sessionMiddleware } = require('../../Middlewares/Auth')
let Sequelize = require("sequelize");
const Op = Sequelize.Op;
const QueryTypes = Sequelize.QueryTypes;
let { OpenAI } = require("openai")

module.exports = class AppController {
    /**
     * Create a project
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */

    async createProject(req, res) {
        // request body
        let input = req.body;
        let result = validateParameters(["name", "organization_id","type","app_id"], input);
        // check parameter validation
        if (result != 'valid') { 
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let user_id = req.authUser.user_id;
        let name = input.name;
        let organization_id = input.organization_id;
        let type = isset(input.type,"basic")
        let purpose = isset(input.purpose,null)
        let website_url = isset(input.website_url,null);
        let app_id = isset(input.app_id,null);
      

        if(app_id!==null){
            let validate_app_id = await App.findOne({
                where:{
                    id:app_id
                }
            })
            if(!validate_app_id){
                return res.status(400).send({type:"RXERROR",message:"Please provide a valid app_id"})
            }
        }

        let checkOrganizationPrivilege = await OrganizationMember.findOne({
            where: {
              user_id: user_id,
              organization_id: organization_id,
              role:'owner'
            }
          })

          if (!checkOrganizationPrivilege) {
            return res.status(400).send({
                type: "RXERROR",
                message: "organization owner is unauthorized"
            })
          }
        
          const plan = await UsageLimit.findOne({
            where : {organization_id : organization_id , app_id : app_id , project_id : null , limit_type : "chatbot"}
          })

        //   if (plan) {
        //     if (plan.plan_id == "1") {
        //         let  freeUsage = await UsageData.findOne({
        //             attributes : [[Sequelize.fn("SUM", Sequelize.col("usage_value")), "usageCount"]],
        //             where : {
        //                 plan_id :"1",
        //                 usage_type : "chatbot"
        //             }
        //         })
        //         freeUsage = JSON.parse(JSON.stringify(freeUsage));
                
        //         if (freeUsage?.usageCount >= 100) {
        //             return res.status(400).send({
        //                 type: "RXERROR",
        //                 message: "To prevent spam, we have set a free project limit. Limit reached. We'll notify you once slots are available, or upgrade to our paid plan. Contact support@yourgpt.ai for more info."
        //             })
        //         }
        //       }
        //   }
        let list_id,brevo_update_data ={}
        let usage_type,valdateLimit=false;
        switch (app_id) {
            case "1":
                usage_type = "chatbot"
                valdateLimit=true;
                list_id = 10
                brevo_update_data.CHATBOT_SETUP = true
                break;
            case "4":
                valdateLimit=false;
                list_id = 13
                // brevo_update_data.TUNEUP_SETUP = true
                break;
            case "3":
                valdateLimit=false;
                list_id = 13
                brevo_update_data.TUNEUP_SETUP = true
                break;
            case "2":
                valdateLimit=true;
                usage_type="workspace"
                break;
            default:
                break;
        }
        
        if(valdateLimit){
            
            const data = await checkOrganizationLimit({organization_id : organization_id , app_id : app_id , project_id : null , usage_type : usage_type})
            if(data?.data < 1){
                return res.status(409).send({
                    type: "RXERROR",
                    message: "You have already reached the limit."
                })
            }else if(data?.message){
                return res.status(400).send({
                    type: "RXERROR",
                    message: data.message
                })
            }
        }
    
     
        let status;
        const myAppId = uuidv4();
        let project_uid = myAppId.substr(0, 8) + myAppId.substr(8, 4) + myAppId.substr(12, 4) + myAppId.substr(16, 4) + myAppId.substr(20);
        // let api_key =  sha256("YOURGPT_SECRET" + project_uid + "-" + Math.floor(Date.now() / 1000) + Math.floor(Date.now() / 1000));
        let data;


        try {
            // Create the project
            data = await Project.create({
                name: name,
                user_id: user_id,
                project_uid:project_uid,
                type: type,
                purpose:purpose,
                // api_key:api_key,
                app_id:app_id,
                organization_id: organization_id,
                created_by: user_id
            });

            if(purpose=='chatbot'){
                let domain_data = await ProjectDomain.findOne({
                    where:{
                        domain:website_url,
                        project_id: data.id
                    }
                })
                if(!domain_data){
                    await ProjectDomain.create({
                        domain:website_url,
                        project_id:data.id
                    })
                }
            }
            // Create Project Session
            await ProjectSetting.create({
                project_id: data.id,
                model: "gpt-3.5-turbo",
                max_tokens: 1000,
                temprature: 1,
                stop:"END",
                prompt_suffix:"###",
                prompt:"You are an AI Assistant chatbot. You will truthfully answer to my messages from the given knowledge base info. say 'Apologies, As an AI assistant I don't have enough information to answer this. Is there anything else I can help you with?' If you do not have enough information to answer. Refuse to answer any message outside the given info."
            });
            // Add the creator to the project
            await ProjectMember.create({
                role: "owner",
                user_id: user_id,
                project_id:data.id
            });
            // create project_usage
            await ProjectUsage.create({
                project_id:data.id,
                plan:'basic',
                query_count:0,
                document_count:0
            })

            // if(type!="basic"){
            //     if(data){
            //         // create project_index 
            //         await ProjectIndex.create({
            //             project_id:data.id,
            //             name:"ProjectS3FileIndex",
            //             connector:"S3Reader",
            //             rebuild_duration: null,
            //             rebuild:"yes",
            //             status:"building",
            //             next_index:null
            //         });
            //     }
            // }
            if (valdateLimit) {
                let by
                await increaseLimit(by=1,{app_id : app_id , organization_id : organization_id , usage_type : usage_type})
            }
            await sendEmailNotification("new_chatbot_created",user_id,{name : data.name})
            const str = `New Project Created\`\`\`user_id =${data.created_by}, project_id=${data.id}, name = ${data.name}, purpose = ${purpose}\`\`\`
            `;
            await notifyOnDiscord(str)

        } catch (err) {
            let error = err;
            logInfo(error)
            return res.status(400).send({
                type: "RXERROR",
                message: "Unable to create data!",
                errors: error
            })
        }
        // // return 200
        // const chatBot = await Project.findAll({
        //     where : {
        //         created_by : user_id
        //     }
        // })
        // const chatbot_count = chatBot.length
        // brevo_update_data.chatbot_count= `${chatbot_count}`
        const searchBy = req.authUser.User.email
        
        const ChatBotData = {
            user_id : user_id,
            list_id : list_id
        }
        const syncChatBotData = await syncContactToChatBotList(ChatBotData)
        const updateChatBotCount = await updateBrevoContact(brevo_update_data,searchBy)
        logInfo("updateChatBotCount",updateChatBotCount);
        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Created Successfully!",
            data: data
        })
    }

    /**
     * Update project 
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */

    async updateProject(req, res) {
        // request body
        let input = req.body;
        let name = isset(input.name, null);
        let retention_duration = isset(input.retention_duration, null);
        let user_id = req.authUser.user_id;
        // dd(user_id)
        let result = validateParameters(["project_uid"], input);
        // check parameter validation
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        // get project_data using project_uid
        let data = await Project.findOne({
            where:{
                project_uid:input.project_uid
            }
        });
        let project_id = data.id;
        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:["owner","editor"],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        let updateStatement = {};

        if (name != null) {
            updateStatement.name = name;
        }
        if (retention_duration != null) {
            updateStatement.retention_duration = retention_duration;
        }
        if(retention_duration==0){
            updateStatement.retention_duration = null;
        }

        // update
        try {
            await Project.update(updateStatement, {
                where: {
                    project_uid: input.project_uid
                }
            })
        } catch (err) {
            let error = err;
            return res.status(400).send({
                type: "RXERROR",
                message: "Oops! some error occured!",
                error: error
            })
        }

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Updated Successfully!"
        })
    }
    
    /**
     * Get all project of user
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getMyProjects(req, res) {
        // request body
        let input = req.body;
        
        let orderBy = isset(input.orderBy, "DESC");
        let app_id = isset(input.app_id, null);
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }
    
        let user_id = req.authUser.user_id;
        let search = isset(input.search, null);
        let customWhere={};

        if(search != null) {
            customWhere={
                name:{
                    [Op.like]: (typeof search!="undefined"?search+"%":"%")
                }
            }
        }else{
            customWhere = {}
        }

        let custom_app_id={};

        if(app_id != null) {
            custom_app_id={
                app_id:{
                    [Op.like]: (typeof app_id!="undefined"?app_id+"%":"%")
                }
            }
        }else{
            custom_app_id = {}
        }

        
        // Get projects data
        const data = await Project.findAndCountAll({
            distinct: true,
            where: {
                [Op.or]: [
                  // find projects where the user is a member of the organization
                  {
                    '$organization->OrganizationMembers.user_id$': user_id
                  },
                  // find projects where the user is a member of the project
                  {
                    '$ProjectMembers.user_id$': user_id
                  },
              
                ],
                ...customWhere,
                ...custom_app_id
            },
            include: [
              {
                
                as:'organization',
                model: Organization,
                attributes:["id","created_by","name",
                [Sequelize.literal("CASE WHEN openai_key IS NULL THEN 'false' ELSE 'true' END"), "has_openai_key"]
              ],
                include: [
                  {
                    as:'OrganizationMembers',
                    model: OrganizationMember,
                    attributes: []
                  }
                ]
              },
              {
                as:'ProjectMembers',
                model: ProjectMember,
                attributes: ["user_id","role"],
                where: { user_id: user_id }
              },
                {
                    model: ChatbotIntegrationsSetting,
                    attributes:["id","project_id","widget_uid"],
                    as: "integration_setting"
                }
            ]
          });
        // return 200
        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Data Fetched Successfully!",
            total:data.count,
            data:data['rows']
        })
    }

    async refreshProjectKey(req,res){
        let input = req.body;
        let api_key = req.project.api_key;
        let project_uid =  sha256("YOURGPT_SECRET" + api_key + "-" + Math.floor(Date.now() / 1000));
        let data =  await Project.update(
            {
              project_uid: project_uid,
            },
            {
              where: {
                api_key: api_key,
              },
            }
          );
        if(data){
            return res.status(200).send({ "type": "RXSUCCESS", "message": "Project key refreshed successfully"});
        }else{
            return res.status(400).send({ "type": "RXERROR", "message": "Something went wrong"});
        }
    }
    
    /**
     * Update project setting
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async updateProjectSettings(req,res){
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id;
        let project_uid = input.project_uid;
        // check parameter validation
        let result = validateParameters(["project_uid"], input);

        if (result != 'valid') { 
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        // Get project data with project_setting on the base of project_uid
        let data = await Project.findOne({
            include:[{
                model:ProjectSetting,
                as:'projectSetting'
            }],
            where:{
                project_uid:project_uid
            }
        });

        let project_id = data.id;

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:["owner"],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        
        if(data){
            // let check_organization = await OrganizationMember.findOne({
            //     where:{
            //         organization_id:data.organization_id,
            //         role : "owner",
            //         user_id : user_id
            //     }
            // })
    
            // if(!check_organization){
            //     return res.status(400).send({type:"RXERROR",message:"you are not a owner of this organization"})
            // }
            if(typeof input.project_id!="undefined"){
                delete input.project_id;
            }

            if(input.openai_api_key && input.openai_api_key != null) {

    
                const openai = new OpenAI({
                    apiKey: input.openai_api_key,
                });
                
                try{
                    const response = await openai.models.retrieve('text-davinci-003')
    
                    if (response.status === 200) {
                        input.openai_api_key = input.openai_api_key; 
                    }
                }catch(err){
                    return res.status(400).send({
                        type:"RXERROR",
                        message:"Please pass valid openai_api_key!"
                    })
                }
                input.openai_api_key  = await encrypt(input.openai_api_key);
            }
            if (input.palm_api_key && input.palm_api_key != null) {
                input.palm_api_key  = await encrypt(input.palm_api_key);
            }
          
            let project_setting_id = data.projectSetting[0]['id'];
            await  ProjectSetting.update(input,{ 
                where : { id : project_setting_id }
            });
            // return 200
            return res.status(200).send({ "type": "RXSUCCESS", "message": "Project setting updated successfully"});
        }else{
            // return 400
            return res.status(400).send({ "type": "RXERROR", "message": "Project not found"});
        }
    }

    async generateProjectKey(req, res) {
        let input = req.body;
        let user_id = req.authUser.user_id
      
        let result = validateParameters(["name","project_uid"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        const projectdata = await Project.findOne({
            where : {project_uid : input.project_uid}
        })

        if (!projectdata) {
            return res.status(400).send({
                type: "RXERROR",
                message: "project does't not exist",
            });
        }
        const project_id = projectdata.id

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['viewer','owner','editor'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        const publicKeyStr = "YOURGPT_PUBLIC_KEY"+ Date.now() + input.project_uid + Math.floor(Math.random() * 100000)
        const publicKeyHash = sha256(publicKeyStr)
        const public_key = "pks-" + publicKeyHash

        const secretKeyStr = "YOURGPT_SECRET_KEY" + Date.now() + input.project_uid + Math.floor(Math.random() * 100000)
        const secretKeyHash = sha256(secretKeyStr)
        const secret_key = "sck-" + secretKeyHash

        const apiKeyStr = "YOURGPT_API_KEY" + Date.now() + input.project_uid + Math.floor(Math.random() * 100000)
        const apiKeyHash = sha256(apiKeyStr)
        const api_key = "apk-" + apiKeyHash

        const data = await ProjectKey.create({name:input.name,project_id:project_id,public_key:public_key,secret_key:secret_key,api_key : api_key})

        if(data){
            return res.status(200).send({
                type:"RXSUCCESS",
                message:"projectKey generated successfully",
                data:data
            })
        }
    }

    async getProjectKey(req, res) {
        let input = req.body;
        let user_id = req.authUser.user_id;
        let result = validateParameters(["project_uid"], input);
        let project_uid = input.project_uid;

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
       
        // call getProject function to get project_id
        let project_data = await getProject(res,project_uid);
        let project_id = project_data.id;

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner', 'editor', 'viewer'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        const data = await ProjectKey.findAll({
            attributes:['id','project_id',
                [Sequelize.fn('CONCAT', Sequelize.fn('SUBSTR', Sequelize.col('public_key'), 1, 3), '......', Sequelize.fn('SUBSTR', Sequelize.col('public_key'), -3)), 'public_key'],
                [Sequelize.fn('CONCAT', Sequelize.fn('SUBSTR', Sequelize.col('secret_key'), 1, 3), '......', Sequelize.fn('SUBSTR', Sequelize.col('secret_key'), -3)), 'secret_key'],
                [Sequelize.fn('CONCAT', Sequelize.fn('SUBSTR', Sequelize.col('ProjectKey.api_key'), 1, 3), '......', Sequelize.fn('SUBSTR', Sequelize.col('ProjectKey.api_key'), -3)), 'api_key'],
                "name","active","createdAt","deletedAt"
            ],
            include : [
                {
                    model : Project,
                    attributes : [],
                    as:"project",
                    where :{project_uid : input.project_uid},
                }
            ],
            paranoid: true
        })

        if(data.length > 0){
            return res.status(200).send({
                type:"RXSUCCESS",
                message:"The ProjectKey was successfully fetched",
                data:data
            })
        }

        return  res.status(400).send({
            type:"RXERROR",
            message:"project key does't not exist",
        })
    }

    async deactivateProjectKey(req, res) {
        let input = req.body;
        const user_id = req.authUser.user_id
        let result = validateParameters(["project_uid","id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        const project = await Project.findOne({
            where : {project_uid : input.project_uid}
        })
        if (!project) {
            return res.status(400).send({
                type: "RXERROR",
                message: "project does't not exist",
            });
        }

        const project_id = project.id

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        const data = await ProjectKey.update({active : "0"},{
            where : {project_id : project_id,id:input.id},
        })

        if(data == 1){
            return res.status(200).send({
                type:"RXSUCCESS",
                message:"The ProjectKey has been successfully deactivated",
            })
        }

        return  res.status(400).send({
            type:"RXERROR",
            message:"Data not found",
        })
    }

    async deleteProjectKey(req, res) {
        let input = req.body;
        const user_id = req.authUser.user_id
        let result = validateParameters(["project_uid","id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        const data = await Project.findOne({
            where : {project_uid : input.project_uid}
        })

        if (!data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "project does't not exist",
            });
        }

        const project_id = data.id

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // logInfo(data[0]);
        const ProjectDelete = await ProjectKey.destroy({
            where : {project_id : project_id,id : input.id},
            paranoid : true
        })
      
        if (ProjectDelete == 1) {
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "ProjectKey deleted successfully",
            });
        }

        return res.status(400).send({
            type: "RXERROR",
            message: "something went to be wrong",
        });
    }

    /**
     * Get projects detail with ProjectKey,Organization,ProjectUsage,ProjectMember,ProjectSetting,ProjectIndex,ProjectFile on the base of project_uid
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getProjectDetail(req, res) {
        // request body
        let input = req.body;
        let project_uid = input.project_uid;
        let user_id = req.authUser.user_id;
        // validate input parameters
        let result = validateParameters(["project_uid"], input);

        if (result != 'valid') { 
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        // call getProject function to get project_id
        let project_data = await getProjectData(project_uid);
        if (!project_data) {
            return res.status(400).send({
                type : "RXERROR",
                message:"Please enter valid project_uid"
            })
        }
        let project_id = project_data.id;

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner', 'editor', 'viewer',"operator"],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        // get project detail with ProjectKey,ProjectUsage,ProjectMember,ProjectSetting,ProjectIndex,ProjectFile on the base of project_uid
        let data = await Project.findOne({

            include:[
                {
                    attributes:['id','project_id',
                        [Sequelize.fn('CONCAT', Sequelize.fn('SUBSTR', Sequelize.col('public_key'), 1, 3), '......', Sequelize.fn('SUBSTR', Sequelize.col('public_key'), -3)), 'public_key'],
                        [Sequelize.fn('CONCAT', Sequelize.fn('SUBSTR', Sequelize.col('secret_key'), 1, 3), '......', Sequelize.fn('SUBSTR', Sequelize.col('secret_key'), -3)), 'secret_key'],
                        [Sequelize.fn('CONCAT', Sequelize.fn('SUBSTR', Sequelize.col('api_key'), 1, 3), '......', Sequelize.fn('SUBSTR', Sequelize.col('secret_key'), -3)), 'api_key'],
                        "name","active","createdAt","deletedAt"
                    ],
                    model: ProjectKey,
                    as:"ProjectKeys",
                    required:false
                },
                {
                    model:Organization,
                    as:'organization',
                    attributes: [
                        "id",
                        "name",
                        [Sequelize.literal("CASE WHEN openai_key IS NULL THEN 'false' ELSE 'true' END"), "has_openai_key"],
                    ],

                },
                {
                    model:ProjectUsage,
                    as:'ProjectUsage'

                },
                {
                    model:ProjectMember,
                    as:"ProjectMembers",
                    attributes: ["user_id","role"],
                    where: { user_id: user_id }
                },
                {
                    model:ProjectSetting,
                    as:"ProjectSetting"
                },
                {
                    model:ProjectIndex,
                    as:"ProjectIndexes"
                },
                {
                    model:ProjectFile,
                    as:"ProjectFiles"
                }
            ],
            where:{
                project_uid: input.project_uid
            },
            paranoid: true
        })

        if(data == null) {
            // return 400 
            return res.status(400).send({
                type:"RXERROR",
                message: "No Records Found!"
            })
        }
        // return 200 success response 
        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Data Fetched Successfully!",
            data: data
        })

    }

    async activateProjectKey(req,res){
        let input = req.body;
        let user_id = req.authUser.user_id;
        let result = validateParameters(["project_uid","id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        const project = await Project.findOne({
            where : {project_uid : input.project_uid}
        })
        if (!project) {
            return res.status(400).send({
                type: "RXERROR",
                message: "project does't not exist",
            });
        }

        const project_id = project.id

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        const data = await ProjectKey.update({active : "1"},{
            where : {project_id : project_id,id:input.id},
        })
       
        if(data == 1){
            return res.status(200).send({
                type:"RXSUCCESS",
                message:"The ProjectKey has been successfully activated",
            })
        }

        return  res.status(400).send({
            type:"RXERROR",
            message:"Data not found",
        })
    }

    /**
     * Delete project on the base of project_uid
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async deleteProject(req,res){
        // request body
        let input = req.body;
        let project_uid = input.project_uid;
        let user_id = req.authUser.user_id;
        // validate input parameters
        let result = validateParameters(["project_uid"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        const projectData = await Project.findOne({
            where : {
                project_uid : project_uid
            }
        })
        if (!projectData) {
            return res.status(400).send({ type:"RXERROR",message:"Project Not found"})
        }
        let project_id = projectData.id;

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        const organization_id = projectData.organization_id
        const app_id = projectData.app_id
        // delete project on the base of project_uid and user_id(only user can delete his project)
        let usage_type
        switch (app_id) {
            case 1:
                usage_type = "chatbot"
                break;
            case 4:
                break;
            case 2:
                usage_type="workspace"
                break;
            default:
                break;
        }
        let data = await Project.destroy({
            where:{
                project_uid:project_uid,
                created_by:user_id
            },
            // paranoid : true
        })
        if(data){
            // return 200
            await UsageData.decrement('usage_value', { by: 1, where: { organization_id: organization_id,app_id : app_id , usage_type:usage_type}});
            return res.status(200).send({ type:"RXSUCCESS",message:"Project deleted successfully"})
        }else{
            // return 400
            return res.status(400).send({ type:"RXERROR",message:"Project Not found"})
        }
    }

    async getTrainingStatus(req,res){
         // request body
         let input = req.body;
         let project_uid = input.project_uid;
         let user_id = req.authUser.user_id;
         // validate input parameters
         let result = validateParameters(["project_uid"], input);
 
         if (result != 'valid') {
             let error = formatJoiError(result.errors);
             return res.status(400).send({
                 type: "RXERROR",
                 message: "Invalid params",
                 errors: error
             });
         }
 
         const projectData = await Project.findOne({
             where : {
                 project_uid : project_uid
             }
         })
         if (!projectData) {
             return res.status(400).send({ type:"RXERROR",message:"Project Not found"})
         }
         let project_id = projectData.id;

         
        const variants = [
            "🔄 Chatbot training is happening right now ⚡️",
            "💻 Chatbot training is in full swing 📚",
            "🎓 Chatbot training is underway with enthusiasm ✨",
            "🤖 Chatbot training is in progress, stay tuned 🎯",
            "🌟 Chatbot training is happening as we speak 📢",
            "🏋️‍♀️ Chatbot training is actively taking place 💪",
            "📝 Chatbot training is currently in session 📚",
            "🌐 Chatbot training is in motion, exploring new possibilities 🚀",
            "🧠 Chatbot training is actively being optimized 🔧",
            "🎯 Chatbot training is on target and making strides 🚀"
        ];
          
        const randomVariant = variants[Math.floor(Math.random() * variants.length)];
        
        let fileData = await ProjectFile.findOne({
            where: {
                status:{
                    [Op.in]:['pending','running'],
                },
                project_id: project_id
            }
        });

        if(fileData){
            return res.status(200).send({
                type:"RXSUCCESS",
                message:randomVariant,
                data:{
                    status:'training'
                }
            })
        }

        let urlData = await ProjectUrl.findOne({
            where: {
                status:{
                    [Op.in]:['pending','running'],
                },
                project_id: project_id
            }
        });

        if(urlData){
            return res.status(200).send({
                type:"RXSUCCESS",
                message:randomVariant,
                data:{
                    status:'training'
                }
            })
        }
        const CompletedVariants = [
            "✅ Chatbot training completed successfully! 🎉",
            "🎓 Chatbot training concluded with great results! 🌟",
            "🚀 Chatbot training finished and ready to assist! 🤖",
            "🔒 Chatbot training finalized with top-notch performance! 💪",
            "🎉 Chatbot training completed, marking a significant milestone! 🎊",
            "🏆 Chatbot training wrapped up flawlessly! 🥇",
            "🔔 Chatbot training completed on schedule! ⌛️",
            "💡 Chatbot training successfully accomplished its objectives! 💪",
            "💯 Chatbot training completed with flying colors! 🌈",
            "🌟 Chatbot training successfully concluded, shining bright! ✨"
        ];  
        const randomCompletedVariant = CompletedVariants[Math.floor(Math.random() * CompletedVariants.length)];
        
        return res.status(200).send({
            type:"RXSUCCESS",
            message:randomCompletedVariant,
            data:{
                status:'completed'
            }
        })
    }

    async searchIndexDocument(req,res){
        let input = req.body;
        logInfo("input", input)
        
        // check parameter validation
        let result = validateParameters(["project_uid", "app_id", "query","limit"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            })
        }

        let project_uid = input.project_uid;
        let app_id = input.app_id;
        let query = input.query;
        let limit = input.limit;

        const projectData = await Project.findOne({
            include: [ { model: ProjectSetting, as: 'projectSetting' } ],
            where : { project_uid : project_uid, app_id : app_id }
        })
        if (!projectData) {
            return res.status(400).send({ type:"RXERROR",message:"Project Not found"})
        }

        let { openai_api_key } = config("openai");
        // get knowledgebase
        process.env.OPENAI_API_KEY=openai_api_key

        let { VectorStoreIndex, QdrantVectorStore, Settings  } = require("llamaindex");
        let { qdClient, collectionName } = getQdrantConfig(projectData.projectSetting[0])
        const vectorStore = new QdrantVectorStore({
          collectionName: collectionName,
          client: qdClient
        });

       
        Settings.embedModel = getEmbeddingConfig(projectData?.projectSetting[0]?.embed_model);  
        //logInfo("Settings.embedModel",Settings.embedModel)  
        const index = await VectorStoreIndex.fromVectorStore(vectorStore, Settings);
        let retriever=index.asRetriever()
        let vectordb_tier=projectData.projectSetting[0].vectordb_tier;
        let searchFilters = { filters:[] };
        if(vectordb_tier!=1){
            searchFilters={
                filters:[
                {
                    key: "project_id",
                    value: projectData.id,
                    filterType: "ExactMatch",
                }
            ],
                params:{
                    hnsw_ef: 128,
                    exact: true
                }
            }
        }
        if(typeof input.node_id!="undefined"){
            searchFilters.filters.push({
                key: "doc_id",
                value:  `${input.node_id}`,
                filterType: "ExactMatch",
            })
        }
        retriever.topK = +limit;
        let nodes=[]
        try{
            nodes=await retriever.retrieve({
                query: query,
                preFilters:searchFilters
            });
            return res.status(200).send({ type: "RXSUCCESS", message: "Data Fetched Successfully!", data: nodes })
        }catch(e){
            logInfo("FETCH DOCUMENT ERROR",e)
            return res.status(400).send({ type: "RXERROR", message: "Something went wrong while fetching the documents"})
        }
    }
    /**
     * To update the index node text
     * 
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async updateIndexPointText(req,res){
        let input = req.body;
        logInfo("input", input)
        
        // check parameter validation
        let result = validateParameters(["project_uid", "app_id", "text","point_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            })
        }

        // take input
        let project_uid = input.project_uid;
        let app_id = input.app_id;
        let text = input.text;
        let point_id= input.point_id;
        let user_id = req.authUser.user_id;

        if(text.length>4500){
            return res.status(400).send({ type: "RXERROR", message: "Text length should be less than 3500 characters"})
        }

        // get project data
        const projectData = await Project.findOne({
            include: [ { model: ProjectSetting, as: 'projectSetting' } ],
            where : { project_uid : project_uid, app_id : app_id }
        })
        if (!projectData) {
            return res.status(400).send({ type:"RXERROR",message:"Project Not found"})
        }

        // check for user permission
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: projectData.id }, allowedRole: ['owner', 'editor'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        // retrive before updating
        let { openai_api_key } = config("openai");
        process.env.OPENAI_API_KEY=openai_api_key
        let { qdClient, collectionName } = getQdrantConfig(projectData.projectSetting[0])
        logInfo("collectionName", collectionName, point_id)
     
        let nodes=await qdClient.retrieve(collectionName, {
            ids: [point_id]
        });
        if(nodes.length==0){
            return res.status(400).send({ type: "RXERROR", message: "Node not found"})
        }
        
        // modify the payload
        let pointData=nodes[0].payload;
        let payloadProjectId=pointData.project_id;
        let payloadNodeText=JSON.parse(pointData['_node_content'])
        pointData['_node_content']=JSON.stringify({...payloadNodeText, text:text})
        let embedModel=projectData?.projectSetting[0]?.embed_model

        // project data id should match payload project id
        if(projectData.id!=payloadProjectId){
            return res.status(400).send({ type: "RXERROR", message: "You are not authorized to update this node"})
        }

        // Embedding generate
        const openai = new OpenAI({
            apiKey: openai_api_key
        });  
        const embedding = await openai.embeddings.create({
            model: embedModel,
            input: text,
            encoding_format: "float",
        });
        let embeddingData=embedding.data[0].embedding;

        // Update node
        let updateData=await qdClient.upsert(collectionName, {
            points: [
                {
                    id: point_id,
                    payload: pointData,
                    vector: embeddingData
                }
            ]
        });
      
        return res.status(200).send({ type: "RXSUCCESS", message: "Node updated Successfully!", data:updateData })
    }
    /**
     * To remove the vector index point
     * 
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async removeIndexPoint(req,res){
        let input = req.body;
        logInfo("input", input)
        
        // check parameter validation
        let result = validateParameters(["project_uid", "app_id","point_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            })
        }

        // take input
        let project_uid = input.project_uid;
        let app_id = input.app_id;
        let point_id= input.point_id;
        let user_id = req.authUser.user_id;

        // get project data
        const projectData = await Project.findOne({
            include: [ { model: ProjectSetting, as: 'projectSetting' } ],
            where : { project_uid : project_uid, app_id : app_id }
        })
        if (!projectData) {
            return res.status(400).send({ type:"RXERROR",message:"Project Not found"})
        }

        // check for user permission
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: projectData.id }, allowedRole: ['owner', 'editor'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // delete the node
        let { qdClient, collectionName } = getQdrantConfig(projectData.projectSetting[0])
        let data=await qdClient.delete(collectionName, {
            points: [point_id],
            filter: {
                must: [
                    {
                        key: "project_id",
                        match: {
                            value: projectData.id,
                        },
                    },
                ],
            },
        });

        return res.status(200).send({ type: "RXSUCCESS", message: "Node deleted Successfully!", data:data })
    }

    /**
   * @param {*} req
   * @param {*} res
   * @returns
   */
  async migrateVectordbTier(req, res) {
    let input = req.body;
    let user_id = req.authUser.user_id;
    let result = validateParameters(["project_uid"], input);

    if (result != 'valid') {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error
      });
    }

    let project_data = await Project.findOne({
      where: {
        project_uid: input.project_uid
      },
      order: [['id', 'DESC']]
    })
    if (!project_data) {
      return res.status(400).send({ type: "RXERROR", message: "Please provide a valid project_uid" })
    }

    let project_id = project_data.id;

    // check user privilege
    const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor'], key: input.project_uid })
    logInfo("permission", permission);
    if (permission !== 'valid') {
      return res.status(400).send({
        type: "RXERROR",
        message: permission.message,
      })
    }
    let projectSetting = await ProjectSetting.findOne({
      where: {
        project_id: project_id
      },
      order: [['id', 'DESC']]
    })
    if (!projectSetting) {
        return res.status(400).send({ type: "RXERROR", message: "Project Setting not found" })
    }
    let vectordb_tier = projectSetting?.vectordb_tier ? projectSetting?.vectordb_tier : 1
    if (vectordb_tier == 2) {
      return res.status(400).send({ type: "RXERROR", message: "Already Migrated" })
    }
    try {
        let projectSettingData = await ProjectSetting.update({ vectordb_tier: 2, embed_model: "text-embedding-3-small" }, {
            where: {
                project_id: project_id
            }
        })
        // for project file
        let project_file = await ProjectFile.findAll({
            where: {
                project_id: project_id
            },
            order: [['id', 'DESC']]
        })
        let project_file_length = project_file.length
        if (project_file_length > 0) {
            let file_index = 0;

            while (project_file_length > 0) {
                const chunk = project_file.slice(file_index, file_index + 15);
                // Process the current chunk
                logInfo("Processing chunk:", chunk);

                // Perform your operation on the chunk
                const chunkIds = chunk.map(item => item.id);
                await ProjectFile.update({ status: "pending", node_id: null, status_info: null },
                    {
                        where: {
                            id: { [Op.in]: chunkIds },
                            project_id: project_id
                        }
                    }
                );

                // Update index for next chunk
                file_index += 15;
                project_file_length -= 15;
            }
            project_file.forEach(async (file) => {
                file.status = "pending"
                await addToIndexQueue("addProjectFile",file)
            })
        }
        // for project urls
        let project_url = await ProjectUrl.findAll({
            where: {
                project_id: project_id
            },
            order: [['id', 'DESC']]
        })
        let project_url_length = project_url.length
        if (project_url_length > 0) {
            let url_index = 0;

            while (project_url_length > 0) {
                let chunk = project_url.slice(url_index, url_index + 15);
                // Process the current chunk
                logInfo("Processing chunk:", chunk);

                // Perform your operation on the chunk
                const chunkIds = chunk.map((item,i) => {
                    chunk[i].status = "pending"
                    return item.id
                });
                await ProjectUrl.update({ status: "pending", node_id: null, status_info: null },
                    {
                        where: {
                            id: { [Op.in]: chunkIds },
                            project_id: project_id
                        }
                    }
                );

                // Update index for next chunk
                url_index += 15;
                project_url_length -= 15;
                await addToIndexQueue("addProjectURL",chunk)
            }
        }
        // for project text
        let project_text = await ProjectText.findAll({
            where: {
                project_id: project_id
            },
            order: [['id', 'DESC']]
        })
        let project_text_length = project_text.length
        if (project_text_length > 0) {
            let text_index = 0;

            while (project_text_length > 0) {
                let chunk = project_text.slice(text_index, text_index + 15);
                // Process the current chunk
                logInfo("Processing chunk:", chunk);

                // Perform your operation on the chunk
                const chunkIds = chunk.map((item,i) => {
                    chunk[i].status = "pending"
                    return item.id
                });
                await ProjectText.update({ status: "pending", node_id: null, status_info: null },
                    {
                        where: {
                            id: { [Op.in]: chunkIds },
                            project_id: project_id
                        }
                    }
                );

                // Update index for next chunk
                text_index += 15;
                project_text_length -= 15;
                await addToIndexQueue("addProjectText",chunk)
            }
        }
    
        // notify to discord
        const str = `Project VectorDB Migrated Successfully \`\`\`user_id =${user_id}, project_id=${project_id} \`\`\``;
        await notifyOnDiscord(str)

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Project Migrated Successfully"
        })
    } catch (error) {
        logInfo(error);
      return res.status(400).send({ type: "RXERROR", message: "Oops! some went wrong" })
    }
  }
}

