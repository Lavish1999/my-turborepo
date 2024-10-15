const { User, UserSession, Session, Organization, Invitation,Project, Contact, SessionMessage, UsageData, EmailVerification ,ProjectText,ProjectSetting } = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer')
let { syncContactToBrevo } = require(baseDir() + "helper/syncContactToBrevo");
let { getImageTextSchema } = require(baseDir() + "validator/ChatbotValidator");
let { formatJoiError, ucfirst, validateParameters, decrypt, loadEmailTemplate, createJwtToken, isset,addToIndexQueue,deleteQdrantDoc,userPrivilege ,getOrganizationLimit } = require(baseDir() + "helper/helper");
let { checkCredits } = require(baseDir() + "helper/chatbot.helper");
// let { sessionMiddleware } = require('../../Middlewares/Auth')
let Sequelize = require("sequelize");
const { Op } = require("sequelize")
const jwt = require('jsonwebtoken');
const YoutubeTranscript = require('youtube-transcript')
let OpenAI = require('openai')
module.exports = class ProjectTextController {
    /**
     * Create contact
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async createProjectText(req, res) { 
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        let result = validateParameters(["detail","type","project_uid"], input);
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
            where:{
                project_uid:input.project_uid
            }
        })
        if(!project_data){
            return res.status(400).send({type:"RXERROR",message:"Please provide a valid project_uid"})
        } 
        let project_id = project_data.id;
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'operator'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        if (input.type == "faq") {
            let result = validateParameters(["short_text"], input);
            // check parameter validation
            if (result != 'valid') { 
                let error = formatJoiError(result.errors);
                return res.status(400).send({
                    type: "RXERROR",
                    message: "Invalid params",
                    errors: error
                });
            }
            var short_text = input.short_text
        }
        let limitCheck = await getOrganizationLimit({app_id:project_data.app_id,project_id:null,organization_id : project_data.organization_id,usage_type : "document"})
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
        let total_project_text = await ProjectText.count({
            where : {
                project_id : project_id
            }
        })
        logInfo(total_project_text);
        if (total_project_text >= limitCheck.data[0].limit_value * 50) {
            return res.status(400).send({
                type: "RXERROR",
                message: `You have reached the total FAQ Soft limit. please contact support to increase your limit!`
            });
        }
        
        try {
            let data = await ProjectText.create({
                project_id : project_id,
                short_text : short_text,
                detail : input.detail,
                type : input.type,
                status : "pending"
            })

            data = {
                "id":data.id,
                "project_id":project_id,
                "short_text" : data.short_text,
                "detail" : data.detail,
                "type" : data.type,
                "status":data.status,
                "created_at":data.createdAt
            }
            await addToIndexQueue("addProjectText",[data])
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Project Text created successfully",
                data : data
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went wrong"
            })
        }
    }

    /**
     * Create contact
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async bulkCreateProjectText(req, res) { 
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        let override = isset(input.override, false);
        let result = validateParameters(["data","type","project_uid"], input);
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
            where:{
                project_uid:input.project_uid
            }
        })
        if(!project_data){
            return res.status(400).send({type:"RXERROR",message:"Please provide a valid project_uid"})
        } 
        let project_id = project_data.id;
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'operator'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let inputDataKey=input.data;
        try{
            inputDataKey=JSON.parse(inputDataKey)
        }catch(e){
            return res.status(400).send({type:"RXERROR",message:"Invalid json"})
        }
       
        let bulkCreateData=[];
        let short_text=null;
        for (let i = 0; i < inputDataKey.length; i++) {
            const value = inputDataKey[i];
            if (input.type == "faq") {
                let result = validateParameters(["short_text"], value);
                // check parameter validation
                if (result != 'valid') { 
                    let error = formatJoiError(result.errors);
                    return res.status(400).send({
                        type: "RXERROR",
                        message: "Invalid params",
                        errors: error
                    });
                }
                let faq_data = await ProjectText.findOne({
                    where:{
                        short_text:value.short_text,
                        project_id:project_id
                    }
                })
                if (faq_data) {
                    if(override) {
                            await ProjectText.update({
                            detail : value.detail
                        },{
                            where:{
                                id:faq_data.id
                            }
                        })
                    }
                    continue;
                }
                short_text = value.short_text
            }
            bulkCreateData.push({
                project_id : project_id,
                short_text : short_text,
                detail : value.detail,
                type : input.type,
                status : "pending"
            })
        }


        try {
            let data = await ProjectText.bulkCreate(bulkCreateData)
           

            await addToIndexQueue("addProjectText",data)
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Project Text created successfully",
                data : data
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went wrong"
            })
        }
    }
    
    async updateProjectText(req, res) {
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        let result = validateParameters(["project_uid","id"], input);
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
            where:{
                project_uid:input.project_uid
            }
        })
        if(!project_data){
            return res.status(400).send({type:"RXERROR",message:"Please provide a valid project_uid"})
        } 
        let project_id = project_data.id;
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'operator'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        if(typeof input.short_text!="undefined"){
            if(input.short_text==null || input.short_text.length<1){
                return res.status(400).send({type:"RXERROR",message:"Short text cannot be null or empty"})
            }
        }
        if(typeof input.detail!="undefined"){
            if(input.detail==null || input.detail.length<1){
                return res.status(400).send({type:"RXERROR",message:"Please add some detail to update"})
            }
        }
        
        try {
            let data = await ProjectText.update(input,{
                where : {
                    id : input.id,
                    project_id: project_id
                }
            })
             data = await ProjectText.findOne({
                where : {
                    id : input.id
                }
            })
            data = {
                "id":data.id,
                "project_id":project_id,
                "short_text" : data.short_text,
                "detail" : data.detail,
                "type" : data.type,
                "status":data.status,
                "created_at":data.createdAt
            }
            await addToIndexQueue("updateProjectText",[data])
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Project Text updated successfully",
                data : data
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went wrong"
            })
        }
    }

    async deleteProjectText(req, res) {
        // request body
        let input = req.body;
        let result = validateParameters(["id","project_uid"], input);
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
            where:{
                project_uid:input.project_uid
            }
        })
        if(!project_data){
            return res.status(400).send({type:"RXERROR",message:"Please provide a valid project_uid"})
        } 
        let project_id = project_data.id;

        let user_id = req.authUser.user_id;
        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner','editor'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        try {
            let projectTextData = await ProjectText.findOne({
                where : {
                    id : input.id,
                    project_id: project_id
                }
            })
            if(!projectTextData){
                return res.status(400).send({ type:"RXERROR",message:"Not found" })
            }
            let projectSetting = await ProjectSetting.findOne({
                where: {
                    project_id: project_id
                }
            })
           
            let docStatus=await deleteQdrantDoc(projectSetting,projectTextData.node_id)    
            await ProjectText.destroy({
                where:{
                    id:input.id,
                    project_id:project_id
                }
            }); 
            if(docStatus){
                // delete project_url on the base of project_url id and project_id
          
                return res.status(200).send({
                    type : "RXSUCCESS",
                    message : "Project Text deleted successfully"
                })
            }else{
                // return 400
                return res.status(400).send({ type:"RXERROR",message:"Not found" })
            }   

          
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went wrong"
            })
        }
    }

    async getProjectText(req, res) {
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        let result = validateParameters(["type","project_uid"], input);
        // check parameter validation
        if (result != 'valid') { 
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        
        let orderBy = isset(input.orderBy, "DESC");
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }

        let project_data = await Project.findOne({
            where:{
                project_uid:input.project_uid
            }
        })
        if(!project_data){
            return res.status(400).send({type:"RXERROR",message:"Please provide a valid project_uid"})
        } 
        let project_id = project_data.id;
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let search = isset(input.search, null);
        let customWhere={};
        if(search != null) {
            customWhere={
                short_text:{
                    [Op.like]: (typeof search!="undefined"?"%"+search+"%":"%")
                }
            }
        }else{
            customWhere = {}
        }

        if(typeof input.node!="undefined"){
            customWhere.node_id=input.node
        }
        customWhere.project_id=project_id;
        try {
            let data = await ProjectText.findAndCountAll({
                where : {
                    ...customWhere,
                    type : input.type,
                },
                order:[['id', orderBy]],
                limit: limit,
                offset: offset              
            })
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Project Text detail",
                data : data
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went wrong"
            })
        }

    }

    async getYoutubeTranscript(req,res) {
        const input = req.body
        // validate input parameters
        let result = validateParameters(["video_url"], input);
        if (result != 'valid') { 
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            })
        }

        try {
            logInfo(input.video_url);
            let text = ""
            let data = await YoutubeTranscript.YoutubeTranscript.fetchTranscript(input.video_url)
            data.forEach((item) => {
                text = text + item.text + " "
            })
            return res.status(200).send({type : "RXSUCCESS" , message : "data fetch successfully" , data : {text : text}})
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went to be wrong"
            })
        }
    }
    /**
     * enter any image url and get description of that image
     * @param {*} req 
     * @param {*} res 
     * @returns array of object
     */
    async getImageText(req,res){
        let input = req.body
        let result = getImageTextSchema.validate(input, { abortEarly: false ,allowUnknown: true});
        let user_id = req.authUser.user_id

        if (result.error) { 
            let error = formatJoiError(result.error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            })
        }
        let prompt=input.prompt?input.prompt:"extract the text from the image";

        // find projects detail to get the project_id
        let project_data = await Project.findOne({
            include: [{ 
                model: ProjectSetting, 
                as: 'projectSetting' ,
            }],
            where:{
                project_uid: input.project_uid
            }
        })
        // through error if projects data not found
        if(!project_data){
            return res.status(400).send({type:"RXERROR",message:"Please provide a valid project_uid"})
        }
        if(project_data.app_id!=1){
            return res.status(400).send({type:"RXERROR",message:"This project is not allowed to use this feature."})
        }
        try {
            let { openai_api_key } = config('openai');
   
            if(project_data.projectSetting[0]['openai_api_key']){
                openai_api_key=decrypt(project_data.projectSetting[0]['openai_api_key'])
            }

            let project_id = project_data.id;
            // check user privilege
            const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner'],key:input.project_uid})
            if (permission !== 'valid') {
                return res.status(400).send({ type: "RXERROR", message: permission.message })
            }
    
            const organization_id = project_data.organization_id
            // check for the credits
            let checkCredit = await checkCredits(organization_id)
            if (checkCredit.type == "RXERROR") { return res.status(400).send({ type: "RXERROR", message: "Credits finished" }) }
    
            let use_customer_key = checkCredit.data.use_customer_key;
            openai_api_key = use_customer_key ? await decrypt(project_data?.projectSetting[0]?.openai_api_key) : openai_api_key;

            let client = new OpenAI({
                apiKey: openai_api_key, // defaults to process.env["OPENAI_API_KEY"]
            })
            const slicedArr = input?.image_urls.slice(0, 5);
            let data = [];
            let totalPrompt=0;
            
            for (let i = 0; i < slicedArr.length; i++) {
                let response = {}
                let image_url = slicedArr[i];
                logInfo(image_url);
                const chatCompletion = await client.chat.completions.create({
                    model:"gpt-4-vision-preview",
                    messages:[
                      {
                        "role": "user",
                        "content": [
                          {"type": "text", "text": prompt},
                          {
                            "type": "image_url",
                            "image_url": {
                              "url": image_url
                            }
                          }
                        ]
                      }
                    ],
                    max_tokens:1024
                })
                logInfo(chatCompletion.choices[0].message);
                response["key"] = `image${i+1}`
                response["value"] = chatCompletion.choices[0].message.content
                totalPrompt      += chatCompletion['usage'].total_tokens
                data.push(response)
            }
         
            await UsageData.increment('usage_value', { by: 12 * totalPrompt, where: { app_id:1, organization_id:project_data.organization_id,usage_type:'credits' }});
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Data fetch successfully",
                data : data
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type:"RXERROR",
                message :"Something went wrong"
            })
        }
    }
  
}