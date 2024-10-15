const { User, Organization, Invitation, OrganizationMember, PromptHistory, Project, ProjectMember, ProjectSetting, UsageData } = require("../../../../../Models");
let sha256 = require("sha256");
let md5 = require("md5");
let AWS = require('aws-sdk');
let mime = require('mime')
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require("openai");
let nodemailer = require('nodemailer')
let { syncContactToChatBotList, updateBrevoContact } = require(baseDir() + "helper/syncContactToBrevo");
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, getProjectData,encrypt,loadEmailTemplate, getIpDetail, userPrivilege, checkOrganizationLimit, increaseLimit, notifyOnDiscord } = require(baseDir() + "helper/helper");
let Sequelize = require("sequelize");
const Op = Sequelize.Op;

module.exports = class LLMController {

    async createWorkspace(req, res) {
        // request body
        let input = req.body;
        let result = validateParameters(["name"], input);
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
        let app_id = 4

        const organizationData = await OrganizationMember.findOne({
            where: {
                user_id: user_id
            }
        })
        if (!organizationData) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Organization not found",
            })
        }

        let organization_id = organizationData.organization_id
        const myAppId = uuidv4();
        let project_uid = myAppId.substr(0, 8) + myAppId.substr(8, 4) + myAppId.substr(12, 4) + myAppId.substr(16, 4) + myAppId.substr(20);
        let data;

        let usage_type = "workspace"

        const limitCheck = await checkOrganizationLimit({organization_id : organization_id , app_id : app_id , project_id : null , usage_type : usage_type})
        if(limitCheck?.data < 1){
            return res.status(409).send({
                type: "RXERROR",
                message: "You have already reached the limit."
            })
        }else if(limitCheck?.message){
            return res.status(400).send({
                type: "RXERROR",
                message: limitCheck.message
            })
        }

        try {
            // Create the projects
            data = await Project.create({
                name: name,
                project_uid: project_uid,
                app_id: app_id,
                organization_id: organization_id,
                created_by: user_id,
                purpose : "LLM Spark"
            });

            // Create Project Session
            await ProjectSetting.create({
                project_id: data.id,
                model: "text-davinci-003",
                max_tokens: 1000,
                temprature: 1,
                stop: "END",
                prompt_suffix: "###"
            });

            // Add the creator to the project
            await ProjectMember.create({
                role: "owner",
                user_id: user_id,
                project_id: data.id,
                organization_id: organization_id
            });

            let by
            await increaseLimit(by=1,{app_id : app_id , organization_id : organization_id , usage_type : usage_type})
            // await sendEmailNotification("new_workspace_created",user_id,{name : data.name})
            const str = `New Project Create \`\`\`user_id =${data.created_by} , project_id=${data.id}, name = ${data.name}, purpose = workspace\`\`\``
            await notifyOnDiscord(str)
            const searchBy = req.authUser.User.email

            const ChatBotData = {
                user_id : user_id,
                list_id : 14
            }
            const updateChatBotCount = await updateBrevoContact({LLMSPARK_SETUP : true},searchBy)
            logInfo("updateChatBotCount",updateChatBotCount);
            const syncChatBotData = await syncContactToChatBotList(ChatBotData)
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "Data Created Successfully!",
                data: data
            })
        } catch (err) {
            let error = err;
            logInfo(error)
            return res.status(400).send({
                type: "RXERROR",
                message: "Unable to create data!",
                errors: error
            })
        }
    }

    async getMyWorkSpace(req, res) {
        // request body
        let input = req.body;

        let orderBy = isset(input.orderBy, "DESC");
        let app_id = 4
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }

        let user_id = req.authUser.user_id;
        let search = isset(input.search, null);
        let customWhere = {};

        if (search != null) {
            customWhere = {
                name: {
                    [Op.like]: (typeof search != "undefined" ? search + "%" : "%")
                }
            }
        } else {
            customWhere = {}
        }

        let total_link = 'SELECT COUNT(*) FROM project_urls WHERE project_urls.project_id = Project.id';
        let total_file = 'SELECT COUNT(*) FROM project_files WHERE project_files.project_id = Project.id';

        total_file = '(' + total_file + ')',
            total_link = '(' + total_link + ')'

        // Get projects data
        const data = await Project.findAndCountAll({
            attributes: {
                include: [
                    [Sequelize.literal(total_link), 'total_link'],
                    [Sequelize.literal(total_file), 'total_file'],

                ]
            },
            distinct: true,
            order: [['id', orderBy]],
            limit: limit,
            offset: offset,
            where: {
                ...customWhere,
                app_id,
                // created_by: user_id,
                [Op.or]:{
                    created_by: user_id,
                    id : [Sequelize.literal(`Select project_id from project_members where project_members.user_id = ${user_id} and deleted_at is null`)]
                }
            },
            include: [
                {
                    as: 'organization',
                    model: Organization,
                    attributes: ["id", "created_by", "name",
                        [Sequelize.literal("CASE WHEN openai_key IS NULL THEN 'false' ELSE 'true' END"), "has_openai_key"]
                    ],
                    include: [
                        {
                            as: 'OrganizationMembers',
                            model: OrganizationMember,
                            attributes: []
                        }
                    ]
                },
                {
                    as: 'ProjectMembers',
                    model: ProjectMember,
                    include : [
                        {
                            model : User,
                            attributes : ["id","name","email","profile_pic","username","country","phone_no"],
                            as: 'user'
                        }
                    ]

                }
            ]
        });
        // return 200
        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Fetched Successfully!",
            total: data.count,
            data: data['rows']
        })
    }

    async getWorkSpaceDetail(req, res) {
        // request body
        let input = req.body;
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

        // get project detail with ProjectKey,ProjectUsage,ProjectMember,ProjectSetting,ProjectIndex,ProjectFile on the base of project_uid
        let data = await Project.findOne({

            include: [
                {
                    model: Organization,
                    as: 'organization',
                    attributes: [
                        "id",
                        "name",
                        [Sequelize.literal("CASE WHEN openai_key IS NULL THEN 'false' ELSE 'true' END"), "has_openai_key"],
                    ],

                },
                {
                    model: ProjectMember,
                    as: "ProjectMembers",
                    include : [
                        {
                            model : User,
                            attributes : ["id","name","email","profile_pic","username","country","phone_no"],
                            as: 'user'
                        }
                    ]
                },
                {
                    model: ProjectSetting,
                    as: "ProjectSetting"
                },
            ],
            where: {
                project_uid: input.project_uid
            },
            paranoid: true
        })

        if (data == null) {
            // return 400 
            return res.status(400).send({
                type: "RXERROR",
                message: "No Records Found!"
            })
        }
        // return 200 success response 
        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Fetched Successfully!",
            data: data
        })

    }

    // PromptScenario history

    /**
 * 
 * @param {*} req 
 * @param {*} res 
 * 
 * 
 */

    async savePromptScenarioHistory(req, res) {
        // request body
        let input = req.body;
        let result = validateParameters(["name", "project_uid"], input);
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

        let project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "project not found"
            });
        }
        let project_id = project_data.id
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        try {
            let promt_scenaio_data = await PromptHistory.create({
                name: name,
                project_id: project_id
            })
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "prompt history created successfully",
                data: promt_scenaio_data
            });
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong"
            });
        }

    }

    async getPromptScenarioFile(req, res) {
        const input = req.body
        let user_id = req.authUser.user_id
        let result = validateParameters(["id", "project_uid"], input);
        // check parameter validation
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid input project_uid",
            });
        }

        let project_id = project_data.id
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let prompt_scenario_file = await PromptHistory.findOne({
            where: {
                project_id: project_id,
                id: input.id
            }
        })
        if (!prompt_scenario_file) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Please enter correct prompt scenario id",
            });
        }
        try {
            let fileName = prompt_scenario_file.name;
      

            AWS.config.update({
                accessKeyId: config("aws").accessKeyId, // Access key ID
                secretAccessKey: config("aws").secretAccessKey, // Secret access key
                region: config("aws").region //Region
            });

            let s3 = new AWS.S3({
                // signatureVersion: 'v4'
            });
            let file_name = `promt_scenario_file/${fileName}`
            let signedUrl = s3.getSignedUrl('getObject', {
                Bucket: config("aws").bucketName,
                Key: file_name,
                Expires: 60
            });

            return res.status(200).send({
                type: "RXSUCCESS",
                message: "data fetch successfully",
                data: signedUrl
            });
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong"
            });
        }
    }

    async updatePrompScenariohistory(req, res) {
        const input = req.body
        let result = validateParameters(["promt_scenario_id"], input);
        // check parameter validation
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        let prompt_senario_data = await PromptHistory.findOne({
            where: {
                id: input.promt_scenario_id
            }
        })
        if (!prompt_senario_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Please enter valid input value promt_scenario_id"
            });
        }
        try {
            await PromptHistory.update(input, {
                where: {
                    id: input.promt_scenario_id
                }
            })
            prompt_senario_data = await PromptHistory.findOne({
                where: {
                    id: input.promt_scenario_id
                }
            })
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "data updated successfully",
                data: prompt_senario_data
            });
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong"
            });
        }
    }

    async deletePrompScenariohistory(req, res) {
        // request body
        let input = req.body;
        let project_uid = input.project_uid;
        let user_id = req.authUser.user_id;
        // validate input parameters
        let result = validateParameters(["promt_scenario_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let prompt_senario_data = await PromptHistory.findOne({
            where: {
                id: input.promt_scenario_id
            }
        })
        if (!prompt_senario_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Please enter valid input value promt_scenario_id"
            });
        }

        try {
            let data = await PromptHistory.destroy({
                where: {
                    id: input.promt_scenario_id
                }
            })
            return res.status(200).send({ type: "RXSUCCESS", message: "Promt scenario deleted successfully" })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong"
            });
        }
    }

    /**
     * Get signed url
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getSignedUrl(req, res) {
        // Input & validate
        let input = req.body;
        logInfo("getSignedUrl input log", input);
        let result = validateParameters(["file_name","project_uid"], input);
        // check parameter validation
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let fileName = input.file_name;
        fileName = fileName.replace(/ /g, "-");

        AWS.config.update({
            accessKeyId: config("aws").accessKeyId, // Access key ID
            secretAccessKey: config("aws").secretAccessKey, // Secret access key
            region: config("aws").region //Region
        });

        let fileSplit = fileName.split(".")
        // Singed URL
        let filename = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100) + "." + fileSplit[fileSplit.length - 1]
        let modifiedFileName = `promt_scenario_file/${filename}`;
        let s3 = new AWS.S3({
            // signatureVersion: 'v4'
        });
        const mime_type = mime.getType(modifiedFileName)
        // Singed
        let signedUrl = s3.getSignedUrl('putObject', {
            Bucket: config("aws").bucketName,
            Key: modifiedFileName,
            Expires: 3600,
            ContentType: mime_type
        });
        // logInfo('presigned url: ', signedUrl);

        // Return success
        return res.status(200).send({ "type": "RXSUCCESS", "data": { "url": signedUrl, "filename": filename, "mime_type": mime_type, "path": modifiedFileName } });
    }
    /**
         * Get uploaded file url
         * @param {*} req 
         * @param {*} res 
         * @returns 
         */
    // async getPromptScenarioHistory(req, res) {

    //     // request body
    //     let input = req.body;
    //     let result = validateParameters(["file_name"], input);
    //     // check parameter validation
    //     if (result != 'valid') {
    //         let error = formatJoiError(result.errors);
    //         return res.status(400).send({
    //             type: "RXERROR",
    //             message: "Invalid params",
    //             errors: error
    //         });
    //     }

    //     let user_id = req.authUser.user_id;
    //     let file_name = input.file_name;

    //     AWS.config.update({
    //         accessKeyId: config("aws").accessKeyId, // Access key ID
    //         secretAccessKey: config("aws").secretAccessKey, // Secret access key
    //         region: config("aws").region //Region
    //     });

    //     let s3 = new AWS.S3({
    //         // signatureVersion: 'v4'
    //     });

    //     var getParams = {
    //         Bucket: config("aws").assetsbucketName,
    //         Key: "promt_scenario_file/" + file_name
    //     }

    //     let getFile=await new Promise((resolve,error)=>{
    //       s3.getObject(getParams, function(err, data) {
    //         // Handle any error and exit
    //         if (err)
    //           resolve(err);
    //         resolve(data);
    //       });
    //     });
    //     logInfo(getFile);
    //     // get File
    //     if(typeof getFile.ContentType=="undefined"){
    //       return res.status(400).send({"error":{"text":"File not found"}});
    //     }
    //     return res.status(200).send({data : getFile});
    // }

    async getAllPromptScenarioHistory(req, res) {
        // request body
        let input = req.body;
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

        let user_id = req.authUser.user_id;
        let name = input.name;

        let orderBy = isset(input.orderBy, "DESC");
        let app_id = 4
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }
        let search = isset(input.search, null);
        let customWhere = {};

        if (search != null) {
            customWhere = {
                name: {
                    [Op.like]: (typeof search != "undefined" ? search + "%" : "%")
                }
            }
        } else {
            customWhere = {}
        }

        let project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "project not found"
            });
        }
        let project_id = project_data.id
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        try {
            let promt_scenaio_data = await PromptHistory.findAndCountAll({
                where: {
                    project_id: project_id
                },
                limit : limit,
                offset : offset,
                order : [['id',orderBy]]
            })
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "prompt scenario data",
                total : promt_scenaio_data.count,
                data: promt_scenaio_data['rows']
            });
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong"
            });
        }
    }

    async updateProjectSetting(req, res) {
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
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

        let project_data = await Project.findOne({
            include : [
                {
                    model : ProjectSetting,
                    as:'projectSetting'
                }
            ],
            where : {
                project_uid : input.project_uid
            }
        })
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid input for project_uid"
            });
        }
        let project_id = project_data.id
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let openai_api_key = isset(input.openai_api_key , null)
        let palm_api_key = isset(input.palm_api_key , null)
        let chunk_size = isset(input.chunk_size , null)
        let embed_model = isset(input.embed_model , null)
        let anthropic_api_key = isset(input.anthropic_api_key , null)
        let ai21_api_key = isset(input.ai21_api_key , null)
        let cohere_api_key = isset(input.cohere_api_key , null)
        let huggingface_api_key = isset(input.huggingface_api_key , null)
        let replicate_api_key = isset(input.replicate_api_key , null)
        let aws_access_key = isset(input.aws_access_key , null)
        let aws_secret_key = isset(input.aws_secret_key , null)
        let aws_region = isset(input.aws_region , null)
        let altogether_api_key = isset(input.altogether_api_key , null)
        let updateStatement = {}
        if(openai_api_key != null) {
            const openai = new OpenAI({
                apiKey: openai_api_key,
            });
            
            try{
                const response = await openai.models.retrieve('gpt-3.5-turbo');
                if (response.status === 200) {
                    updateStatement.openai_api_key = openai_api_key; 
                }
            }catch(err){
                return res.status(400).send({
                    type:"RXERROR",
                    message:"Please pass valid openai_api_key!"
                })
            }
            updateStatement.openai_api_key  = await encrypt(openai_api_key);
        }
        if (palm_api_key != null && palm_api_key != "") {
            updateStatement.palm_api_key  = await encrypt(palm_api_key);
        }
        if (chunk_size != null) {
            updateStatement.chunk_size  = chunk_size;
        }
        if (embed_model != null) {
            updateStatement.embed_model  = embed_model
        }
        if (anthropic_api_key != null && anthropic_api_key != "") {
            updateStatement.anthropic_api_key  = await encrypt(anthropic_api_key);
        }
        if (ai21_api_key != null && ai21_api_key != "") {
            updateStatement.ai21_api_key  = await encrypt(ai21_api_key);
        }
        if (cohere_api_key != null && cohere_api_key != "") {
            updateStatement.cohere_api_key  = await encrypt(cohere_api_key);
        }
        if (huggingface_api_key != null && huggingface_api_key != "") {
            updateStatement.huggingface_api_key  = await encrypt(huggingface_api_key);
        }
        if (replicate_api_key != null && replicate_api_key != "") {
            updateStatement.replicate_api_key  = await encrypt(replicate_api_key);
        }
        if (aws_access_key != null && aws_access_key != "") {
            updateStatement.aws_access_key  = await encrypt(aws_access_key);
        }
        if (aws_secret_key != null && aws_secret_key != "") {
            updateStatement.aws_secret_key  = await encrypt(aws_secret_key);
        }
        if (aws_region != null && aws_region != "") {
            updateStatement.aws_region  = aws_region;
        }
        
        if (altogether_api_key != null && altogether_api_key != "") {
            updateStatement.altogether_api_key  = altogether_api_key;
        }

        try {
            await ProjectSetting.update(updateStatement,{
                where : {
                    project_id : project_id
                }
            })
            project_data = await Project.findOne({
                include : [
                    {
                        model : ProjectSetting,
                        as:'projectSetting'
                    }
                ],
                where : {
                    project_uid : input.project_uid
                }
            })
            return res.status(200).send({
                type:"RXSUCCESS",
                message:"project Setting update successfully",
                data : project_data
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type:"RXERROR",
                message:"Something went wrong"
            })
        }
    }

    /**
     * Invite project member on the base of email , role and project_id
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async inviteProjectMember(req, res) {
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id;
        let name = req.authUser.User.name;
        let email = req.authUser.User.email;
        // validate input parameters
        let result = validateParameters(["email", "role", "project_uid"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        // find project details on the base of project_id
        let data = await Project.findOne({
            // include : [
            //     {
            //         model : ProjectMember,
            //         as : "ProjectMembers"
            //     }
            // ],
            where:{
                project_uid:input.project_uid,
                app_id: '4'
            }
        })
        if(data==null) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid Project",
            })
        }

        if (email == input.email) {
            return res.status(400).send({
                type: "RXERROR",
                message: "You are trying to send invitation yourself",
            })
        }
        // check if user is already a member
        let user = await User.findOne({
            include : [
                {
                    model : ProjectMember,
                    as : "ProjectMembers",
                    required : false,
                    where : {
                        user_id : {
                            [Op.eq]:Sequelize.col("User.id")
                        },
                        project_id : data.id,
                        organization_id : data.organization_id
                    }
                }
            ],
            where:{
                email:input.email
            }
        })
        // if(project_member) {
        //     return res.status(400).send({
        //         type: "RXERROR",
        //         message: "The user is already a project member.",
        //     })
        // }
        if (!user) {
            let valid = await validateEmail(input.email)
            if (!valid) {
                return res.status(400).send({
                    type: "RXERROR",
                    message: "Invalid email",
                })
            }
        }
        if(user && user.ProjectMembers.length > 0) {
            return res.status(400).send({
                type: "RXERROR",
                message: "The user is already a project member.",
            })
        }

        let projectMember = await ProjectMember.findAll({
            attributes: [
                'user_id'
            ],
            include : [
                {
                    attributes: [],
                    model: Project,
                    as : "Project",
                    where : {
                        app_id: '4'
                    }
                }
            ],
            where : {
                organization_id : data.organization_id
            },
            group : ['user_id']
        })
        let totalMember = projectMember.length
        // check user privilege
            const permission = await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id: data.id},allowedRole:["owner","viewer"],key:data.project_uid})
            if (permission !== 'valid') {
                return res.status(400).send({
                    type: "RXERROR",
                    message: permission.message,
                })
            }
        // check if invitation already send 
        
        let organization_id = data.organization_id
        let customWhere = {
            app_id : "4",
            project_id : null,
            organization_id : organization_id,
            usage_type : "members"
        }
        // let memberCount = data.ProjectMembers.length
        let limitCheck = await checkOrganizationLimit(customWhere)
        logInfo(limitCheck);
        if(limitCheck?.data?.length < 1){
            return res.status(409).send({
                type: "RXERROR",
                message: "You have already reached the limit."
            })
        }else if(limitCheck?.message){
            return res.status(400).send({
                type: "RXERROR",
                message: limitCheck.message
            })
        }
        let member_exists = user ? projectMember.find((item) => item.user_id == user.id) : false
        if (limitCheck.data[0].limit_value <= totalMember && !member_exists) {
            return res.status(400).send({
                "type":"RXERROR",
                "message":`You've reached your member limit. Please either reduce the number of members or consider upgrading your plan.`
            })
        }
        // if (limitCheck.data[0].limit_value <= memberCount) {
        //     return res.status(400).send({
        //         "type":"RXERROR",
        //         "message":`You've reached your member limit. Please either reduce the number of members or consider upgrading your plan.`
        //     })
        // }

        // check if invitation already send     
        let invitationData = await Invitation.findAll({
            where: {
                project_id: data.id,
                status : "pending"
            }
        })
        let sentCheck = invitationData.find((item) => item.email == input.email)
        if (sentCheck) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invitation already sent!"
            })
        }
        logInfo(invitationData.length , limitCheck.data[0].limit_value * 2);
        if (invitationData.length >= limitCheck.data[0].limit_value * 2) {
            return res.status(400).send({
                type: "RXERROR",
                message: "To many invitation pending please remove it first"
            })
        }

        // create hash
        let string = input.email + user_id + Date.now()
        let hash = md5(string)
        try {
            // create invitation
        let entities = await Invitation.create({
            sent_by: user_id,
            sent_to: input.email,
            organization_id: input.organization_id,
            project_id:data.id,
            type:'project',
            email: input.email,
            role: input.role,
            hash: hash,
            status: "pending"
        })

        const maildata = config('mail')
        // logInfo(maildata);
        let transporter = nodemailer.createTransport(maildata);
        
        // send mail with defined transport object
        let htmlMessage = await loadEmailTemplate("inviteLlmSpark.ejs", {
            from : name,
            workspace : data.name,
            hash : hash
        });
        let info = await transporter.sendMail({
            from:"noreply@yourgpt.ai", // sender address
            to: input.email, // list of receivers
            subject: "Invitation for workspace member", // Subject line
            html: htmlMessage, // plain text body
        });

        if (info.messageId) {
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "Invitation Sent Successfully",
                data: entities
            })
        }
        // return 200
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong",
            })
        }
    }

    async addMemberViaHash(req, res) {

        let input = req.body;
        let email = req.authUser.User.email
        let user_id = req.authUser.user_id
        let result = validateParameters(["hash"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        // check hash

        let data = await Invitation.findOne({
           where: {
            hash: input.hash,
           }
        })

        if (data == null) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid Hash"
            })
        }
        if (email != data.sent_to) {
            return res.status(400).send({
                type: "RXERROR",
                message: "un-Authenticate user"
            }) 
        }
        // find project details on the base of project_id
        let project_data = await Project.findOne({
            // include : [
            //     {
            //         model : ProjectMember,
            //         as : "ProjectMembers",
            //     }
            // ],
            where:{
                id:data.project_id
            }
        })
        let organization_id = project_data.organization_id
        let projectMember = await ProjectMember.findAll({
            attributes: [
                'user_id'
            ],
            include : [
                {
                    attributes: [],
                    model: Project,
                    as : "Project",
                    where : {
                        app_id: '4'
                    }
                }
            ],
            where : {
                organization_id : organization_id
            },
            group : ['user_id']
        })
        let totalMember = projectMember.length
        let customWhere = {
            app_id : "4",
            project_id : null,
            organization_id : organization_id,
            usage_type : "members"
        }
        // let memberCount = project_data.ProjectMembers.length
        let limitCheck = await checkOrganizationLimit(customWhere)
        if(limitCheck?.data.length < 1){
            return res.status(409).send({
                type: "RXERROR",
                message: "You have already reached the limit."
            })
        }else if(limitCheck?.message){
            return res.status(400).send({
                type: "RXERROR",
                message: limitCheck.message
            })
        }
        // if (limitCheck.data[0].limit_value <= memberCount) {
        //     return res.status(400).send({
        //         "type":"RXERROR",
        //         "message":`You've reached your member limit. Please either reduce the number of members or consider upgrading your plan.`
        //     })
        // }

        let member_exists = projectMember.find((item) => item.user_id == user_id)
        let deduction = false
        if (limitCheck.data[0].limit_value <= totalMember && !member_exists) {
            return res.status(400).send({
                "type":"RXERROR",
                "message":`You've reached your member limit. Please either reduce the number of members or consider upgrading your plan.`
            })
        }
        // logInfo(limitCheck.data[0].limit_value , totalMember , member_exists);
        if (!member_exists) deduction = true

        //update status to accepted
        await Invitation.update({
            status:"accepted"
        },{
            where:{
                hash: input.hash
            }
        })


        let entities = await ProjectMember.create({
            user_id: user_id,
            project_id: data.project_id,
            role : data.role,
            organization_id: organization_id
        })

        await Invitation.destroy({
            where: {
             id: data.id,
            }
         })
        deduction && await UsageData.increment('usage_value', { by: 1, where: { app_id:4, organization_id: organization_id, usage_type: 'members' } })

        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Added to Workspace successfully",
            data:entities
        })
    }

     /**
     * get project members detail on the base of project_uid and the invitation
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
     async getProjectMembers(req,res){
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        let project_uid = input.project_uid;
        let search = isset(input.search, null);
        let customWhere ;

    
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
          offset = 0;
        }
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
        // search filter by name or email
        if(search != null) {
            customWhere={
                [Op.or]: [
                    { name: {
                        [Op.like]: (typeof search!="undefined"?search+"%":"%")
                    }},
                    { email: {
                        [Op.like]: (typeof search!="undefined"?search+"%":"%")
                    } }
                  ]
          
            }
        }else{
            customWhere = null
        }
        // find project details on the base of project_uid to get project_id
        let project_data = await Project.findOne({
            where:{
                project_uid:project_uid
            }
        })
        if (!project_data) {
            return res.status(400).send({
                type : "RXERROR",
                message:"invalid project_uid"
            })
        }
        let project_id = project_data.id
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // get project members detail on the base of project_id
        let data = await ProjectMember.findAndCountAll({
            include:[
                {
                    attributes:["id","name","email","username","profile_pic","first_name","last_name"],
                    model:User,
                    as:"user",
                    where: customWhere,

                }],
            where:{
                project_id:project_id
            },
            limit: limit,
            offset: offset
        })
        let invitation = await Invitation.findAll({
            where:{
                project_id:project_id
            }
        })
        // return 200
        return res.status(200).send({type:"RXSUCCESS",message:"Get all project member",total:data.count,data:{projectMember : data['rows'],invitations : invitation}});
    }

    /**
     * remove project member on the base of project_uid and member_id
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async removeProjectMember(req,res){
        // request body
        let input = req.body;
        let project_uid = input.project_uid;
        let user_id = req.authUser.user_id;
        // validate input parameters
        let result = validateParameters(["project_uid","member_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        // find projects detail on the base of project_uid to get project_id
        let data = await Project.findOne({
            where:{
                project_uid:project_uid,
                app_id: '4'
            }
        });
        let project_id = data?.id
        if (!data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Please enter valid project_uid"
            });
        }
        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:["owner","viewer"],key:project_uid})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        let member_data = await ProjectMember.findOne({
            include : [
                {
                    model:Project,
                    as : "Project",
                    required : false,
                    where : {
                        created_by : {
                            [Op.eq]:Sequelize.col("ProjectMember.user_id")
                        }
                    }
                }
            ],
            where: {
                project_id: project_id,
                id: input.member_id
            }
        })
        if (!member_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Not a member of this project"
            });
        }
        if (member_data.Project != null) {
            return res.status(400).send({
                type: "RXERROR",
                message: "You can not remove the user who created the workspace"
            });
        }

        let projectMember = await ProjectMember.findAll({
            attributes: [
                'user_id'
            ],
            include : [
                {
                    attributes: [],
                    model: Project,
                    as : "Project",
                    where : {
                        app_id: '4'
                    }
                }
            ],
            where : {
                organization_id : data.organization_id,
                user_id: member_data.user_id
            },
            group : ['user_id']
        })
        let memberRetrive = projectMember.length == 1 ? true : false

        try{
            // remove the project member on the base of id and project_id
            await ProjectMember.destroy({
                where: {
                    project_id: project_id,
                    id: input.member_id
                }
            })
            memberRetrive && await UsageData.decrement('usage_value', { by: 1, where: { app_id: 4, organization_id: data.organization_id, usage_type: 'members' } })
        }catch(err){
            // return 400
            return res.status(400).send({
                type:"RXERROR",
                message:"Oops! Something went wrong!"
            })
        }
        // return 200
        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Project Member Removed Successfully!"
        })
    }
    /**
     * You can Remove invitation that is pending from long time.
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async removeInvitationByHash(req, res) {
        // request body
        let input = req.body;
        let project_uid = input.project_uid;
        let user_id = req.authUser.user_id;
        // validate input parameters
        let result = validateParameters(["hash","project_uid"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid input project_uid"
            });
        }
        let project_id = project_data.id

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:["owner"],key:project_uid})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // find projects detail on the base of project_uid to get project_id
        let data = await Invitation.findOne({
            where:{
                hash:input.hash
            }
        });
        if (!data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Please enter valid hash"
            });
        }
        await Invitation.destroy({
            where : {
                hash:input.hash
            }
        })

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Invitation removed successfully"
        });
    }
}

async function validateEmail(email) {
    // Regular expression pattern for email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }