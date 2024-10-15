const { Session,Project,SessionMessage,ProjectUrl,sequelize,ProjectSiteMap,UsageData, ProjectSetting} = require("../../../../Models");
let { formatJoiError, isset, validateParameters,getProject,addToIndexQueue,addToLowPriorityIndexQueue, increaseLimit,checkOrganizationLimit,deleteQdrantDoc,userPrivilege } = require(baseDir() + "helper/helper");
let Sequelize = require("sequelize");
const Op = Sequelize.Op;
const QueryTypes=Sequelize.QueryTypes
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
const { v4: uuidv4 } = require('uuid');
const { projectExtraSettingApiValidator } = require(baseDir() + "validator/ChatbotValidator");

module.exports = class ProjectUrlController {
    /**
     * Create project_url
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async createProjectUrl(req,res){
        // request body
        let input = req.body;
        const user_id = req.authUser.User.id
        // validate input parameters
        let result = validateParameters(["url","app_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let project_id ;
        let site_map_id =  isset(input.site_map_id, null);    
        let project_uid = isset(input.project_uid, null);
        let url_data  = input.url; // .toLowerCase(); //change url into lowercase if it is in uppercase
        let app_id = input.app_id;
        let urls = url_data.split(',');
        let organization_id=null;
        let extra_settings = isset(input.extra_settings, null);
        if (extra_settings && typeof input.extra_settings != 'object') {
            if (typeof input.extra_settings == 'string') {
              extra_settings = JSON.parse(input.extra_settings);
            }else {
              return res.status(400).send({
                type: "RXERROR",
                message: "Invalid extra_settings"
              });
            }
          }

        urls=urls.map(url=>{
            return url.endsWith('/') ? url.slice(0, -1) : url;
        })

        if(site_map_id){
            // find project_sitemaps data on the base of id to get project_id
            let sitemap_data = await ProjectSiteMap.findOne({
                include : [
                    {
                        model : Project
                    }
                ],
                where:{
                    id:site_map_id
                }

            })
            // if project_sitemaps data not found then return error
            if(!sitemap_data){
                return res.status(400).send({ type:"RXERROR",message:"Please provide a valid sitemap id" })
            }
            project_id = sitemap_data.project_id
            organization_id = sitemap_data.Project.organization_id

        }else{
            // if sitemap_id has not given then call getProject function to get roject_id
            let project_data = await Project.findOne({
                where: {
                  project_uid: project_uid
                }
            })
            if (!project_data) {
                return res.status(400).send({ type: "RXERROR", message: "Please provide a valid Project Uid" })
            }
            project_id = project_data.id;
            organization_id = project_data.organization_id
            const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
            logInfo("permission", permission);
            if (permission !== 'valid') {
                return res.status(400).send({
                    type: "RXERROR",
                    message: permission.message,
                })
            }
        }

        let usage_type,valdateLimit=false;
        switch (app_id) {
            case "1":
                usage_type = "webpages"
                valdateLimit=true;
                break;
            case "4":
                usage_type = "webpages"
                valdateLimit=true;
                break;
            default:
                break;
        }
        let data
        if(valdateLimit){
            
             data = await checkOrganizationLimit({organization_id : organization_id , app_id : app_id , project_id : null , usage_type : usage_type})
            if(data?.data?.length < 1){
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
        // if more than one url has given in input then map it to get urls in array , object
        // find project_url data on the base of project_id
        const checkUrl = await ProjectUrl.findAll({
            where: {
                url: {
                [Op.in]: [urls],
                },
                project_id:project_id
            }
        });

        // Extract URLs from the checlUrl objects
        const existingUrls = checkUrl.map(u => u.url);
        // Filter out the existing URLs from the input list
        urls = urls.filter(url => !existingUrls.includes(url));

        const extracted_urls = urls.map(url => ({ url, project_id: project_id,site_map_id:site_map_id , user_id : user_id, extra_settings: extra_settings }));
        const url_length = extracted_urls.length;
        const limitLeft = data?.data[0]?.limit_left

        if (valdateLimit == true && limitLeft < url_length) {
          return res.status(400).send({
              type: "RXERROR",
              message: `You don't have sufficient remaining limit to create.`
          })
        }
        try{
            // craete project_url using bulkCreate function to create  multiple urls if found multiple urls 
            let data = await ProjectUrl.bulkCreate(extracted_urls);
            const totalUrl = await ProjectUrl.count({
                where : {
                    project_id:project_id
                }
            })
            if (valdateLimit) {
                let by
                await UsageData.update({usage_value:totalUrl},{where : {app_id : app_id , organization_id : organization_id , usage_type : usage_type}})
            }
            await addToIndexQueue("addProjectURL",data)
            // return 200
            return res.status(200).send({ type:"RXSUCCESS",message:"ProjectUrl created successfully",data:data })
        }catch(err){
            logInfo(err)
            // return 400
            return res.status(400).send({ type:"RXERROR",message:"Something went wrong",error:err })
        }
    }

    /**
     * Get project_url on the base of project_uid
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getProjectUrl(req,res){
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        let project_uid = input.project_uid;
        let orderBy = isset(input.orderBy, "DESC");
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

        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }
        let search = isset(input.search, null);
        let customWhere ;
       

        if(search != null) {
            customWhere={
                url:{
                    [Op.like]: (typeof search!="undefined"?"%"+search+"%":"%")
                },
          
            }
        }else{
            customWhere = {}
        }
        if(typeof input.node!="undefined"){
            customWhere.node_id=input.node
        }

        if (input.status) {
            customWhere.status = input.status;          
        }
        // call getProject function to get project_id
        let project_data = await getProject(res,project_uid);
        let project_id = project_data.id;
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // get project_url data on the base of project_id
        let data = await ProjectUrl.findAndCountAll({
            where:{
                project_id:project_id,
                ...customWhere
            },
            order: [['id', orderBy]],
            limit: limit,
            offset: offset,
        })
        if(data){
            // return 200
            return res.status(200).send({ type:"RXSUCCESS",message:"Get ProjectUrl data", total:data.count,data:data['rows'] })
        }else{
            // return 400
            return res.status(400).send({ type:"RXERROR",message:"Something went wrong" })
        }
    }
 
    async reCrawlProjectUrl(req, res) {
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
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        
        try {
            let data = await ProjectUrl.update({
                status:'updating',
                status_info: null
            },{
                where : {
                    id : input.id,
                    project_id: project_id
                }
            })
           
            data = await ProjectUrl.findOne({
                where : {
                    id : input.id
                }
            })
            data = [data]
            await addToIndexQueue("updateProjectURL",data)
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
    /**
     * Delete project_url on the base of project_uid
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async deleteProjectUrl(req,res){
        // request body
        let input = req.body;
        let id = input.id;
        let project_uid = input.project_uid;
        let current_date = Date.now();
        // validate input parameters
        let result = validateParameters(["id","project_uid"], input);
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
        let organization_id = project_data.organization_id;
        let app_id = project_data.app_id;
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

        // delete project_url on the base of project_url id and project_id
        let projectUrlData = await ProjectUrl.findOne({
            where:{
                id:id,
                project_id:project_id
            }
        });
        if(!projectUrlData){
            return res.status(400).send({ type:"RXERROR",message:"Not found" })
        }
        let projectSetting = await ProjectSetting.findOne({
            where: {
                project_id: project_id
            }
        })
        let docStatus=await deleteQdrantDoc(projectSetting,projectUrlData.node_id)    
        await ProjectUrl.destroy({
            where:{
                id:id,
                project_id:project_id
            }
        }); 
        await UsageData.decrement('usage_value', { by: 1, where: { organization_id: organization_id,app_id : app_id,usage_type : "webpages" }}); 
        if(docStatus){
        // delete project_url on the base of project_url id and project_id
            return res.status(200).send({ type:"RXSUCCESS",message:"Project url deleted successfully" })

            //await addToIndexQueue("deleteProjectURL",{"id":id,"project_id":project_id})
        }else{
            // return 400
            return res.status(200).send({ type:"RXSUCCESS",message:"Not found" })
        }   
    }

    async bulkReIndexUrl(req, res) {
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        // logInfo(input);
        let result = validateParameters(["project_uid","ids"], input);
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
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let ids = input.ids.split(',')
        let projectUrlData = await ProjectUrl.findAll({
            where : {
                project_id : project_id,
                id : {
                    [Op.in]:ids
                }
            }
        })
        if(projectUrlData.length == 0){
            return res.status(400).send({ type:"RXERROR",message:"Not found" })
        }
        logInfo(ids.length , projectUrlData.length);
        if (ids.length != projectUrlData.length) {
            return res.status(400).send({
                type: "RXERROR",
                message: `Some id don't hava projectUrl`,
            })
        }
        try {
            let data = await ProjectUrl.update({
                status:'updating',
                status_info: null
            },{
                where : {
                    project_id : project_id,
                    id : {
                        [Op.in]:ids
                    }
                }
            })
           
            data = await ProjectUrl.findAll({
                where : {
                    project_id : project_id,
                    id : {
                        [Op.in]:ids
                    }
                }
            })
            // add to queue in batch of 5   
            for(let i=0;i<data.length;i+=5){
                await addToLowPriorityIndexQueue("updateProjectURL",data.slice(i,i+5))
            }
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
    /**
     * Delete project_url on the base of project_uid
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async bulkDeleteProjectUrl(req,res){
        // request body
        let input = req.body;
        let id = input.id;
        let project_uid = input.project_uid;
        let current_date = Date.now();
        // validate input parameters
        let result = validateParameters(["ids","project_uid"], input);
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
        let organization_id = project_data.organization_id;
        let app_id = project_data.app_id;
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

        // delete project_url on the base of project_url id and project_id
        let ids = input.ids.split(',')
        let projectUrlData = await ProjectUrl.findAll({
            where : {
                project_id : project_id,
                id : {
                    [Op.in]:ids
                }
            }
        })
        if(projectUrlData.length == 0){
            return res.status(400).send({ type:"RXERROR",message:"Not found" })
        }
        logInfo(ids.length , projectUrlData.length);
        if (ids.length != projectUrlData.length) {
            return res.status(400).send({
                type: "RXERROR",
                message: `Some id don't have projectUrl`,
            })
        }
        let docStatus
        let projectSetting = await ProjectSetting.findOne({
            where: {
                project_id: project_id
            }
        })
    
        for (let i = 0; i < projectUrlData.length; i++) {
            const element = projectUrlData[i];
            docStatus=await deleteQdrantDoc(projectSetting,element.node_id)
        }  
        await ProjectUrl.destroy({
            where : {
                project_id : project_id,
                id : {
                    [Op.in]:ids
                }
            }
        }); 
        await UsageData.decrement('usage_value', { by: projectUrlData.length, where: { organization_id: organization_id,app_id : app_id,usage_type : "webpages" }}); 
        if(docStatus){
        // delete project_url on the base of project_url id and project_id
            return res.status(200).send({ type:"RXSUCCESS",message:"Project url deleted successfully" })

            //await addToIndexQueue("deleteProjectURL",{"id":id,"project_id":project_id})
        }else{
            // return 400
            return res.status(200).send({ type:"RXERROR",message:"Not found" })
        }   
    }

    async reIndexUrlCron(){
        for(let i=0;i<10;i++){
            await this.reIndexUrl()
        }
        return true;  
    }

    async reIndexUrl(){
        let query=`
        SELECT 
            pu.id, pu.site_map_id, pu.project_id,
            pu.user_id, pu.url, pu.node_id, pu.status,
            pu.tags, pu.last_index, pu.created_at,
            pu.updated_at, pu.deleted_at, pu.status_info,
            pu.attempt
        FROM
            project_urls pu
                JOIN
            project_settings s ON pu.project_id = s.project_id
            JOIN 
        projects p ON p.id=pu.project_id
            JOIN
            subscriptions sb on p.organization_id=sb.organization_id 
        WHERE
            TIMESTAMPADD(MINUTE, s.reindex_period, pu.last_index) < NOW()
            AND 
                pu.status='success'
            AND
                sb.status='active'
            ORDER BY id DESC
            limit 5;
        `
        let data = await sequelize.query(query,{
            type: QueryTypes.SELECT
        })
        if(data.length<1){
            return false;
        }
        await addToLowPriorityIndexQueue("updateProjectURL",data);
        let project_urls=[];
        data.forEach((row,index)=>{
            project_urls.push(row.id)
        })
        logInfo(project_urls)
        await ProjectUrl.update({
            status:'updating',
            status_info: null,
            last_index: Sequelize.literal("NOW()")
        },{
            where:{
                id:{
                    [Op.in]:project_urls
                }
            }
        })
        return true;
    }

    async updateProjectUrlExtraSettings(req,res){
        let input = req.body;
        let user_id = req.authUser.user_id
        // validate input parameters
        let result = projectExtraSettingApiValidator.validate(input, { abortEarly: false, allowUnknown: true });

        if (result.error) {
            let error = formatJoiError(result.error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        let project_data = await Project.findOne({
            where:{
                project_uid:input.project_uid
            },
            order: [['id', 'DESC']]
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
        
        try {
            input.ids = input.ids.split(',')
            input.status = "pending";
            await ProjectUrl.update(input,{
                where : {
                    id : {
                        [Op.in]:input.ids
                    },
                    project_id: project_id
                }
            })
           
            let data = await ProjectUrl.findAll({
                where : {
                    id : {
                        [Op.in]:input.ids
                    },
                    project_id: project_id
                }
            })
            await addToIndexQueue("updateProjectURL",data)
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
}