const { User, Organization, Invitation, OrganizationMember, Project, ProjectIndex, ProjectDomain} = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, getIpDetail ,userPrivilege} = require(baseDir() + "helper/helper");
let Sequelize = require("sequelize");
const Op = Sequelize.Op;


module.exports = class ProjectDomainController {

    /**
     * Create project domain 
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async createProjectDomain(req, res) {
    // request body
    let input = req.body;
    let user_id = req.authUser.user_id
    // validate input parameters
    let result = validateParameters(["project_uid", "domain"], input);

    if (result != 'valid') { 
        let error = formatJoiError(result.errors);
        return res.status(400).send({
            type: "RXERROR",
            message: "Invalid params",
            errors: error
        });
    }


    // validate domain
    const regex = new RegExp('^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$');

    let isMatch = regex.test(input.domain);

    if(isMatch == false) {
        return res.status(400).send({
            type:"RXERROR",
            message: "please pass valid domain"
        })
    }
    // find projects data on the base of project_uid to get project_id
    let project = await Project.findOne({
        where:{
            project_uid: input.project_uid
        }
    });
    //  if projects data not found return error
    if(project == null) {
            return res.status(400).send({
            type:"RXERROR",
            message:"Please pass valid project_uid"
        })
    }
    const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project.id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

    let data;

    try{
        // create project_domain
        data = await ProjectDomain.create({
            project_id: project.id,
            domain: input.domain
        })    

    }catch(err){
        // return 400
        return res.status(400).send({
            type:"RXERROR",
            message:"Unable to create data!"
        })
    }
    // return success response 
    return res.status(200).send({
        type:"RXSUCCESS",
        message:"Data created successfully!",
        data: data
    })
    }

    /**
     * Delete project domain on the base of id
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async deleteProjectDomain(req, res) {
    // request body
    let input = req.body;
    // validate input parameters
    let result = validateParameters(["id"], input);

    if (result != 'valid') { 
        let error = formatJoiError(result.errors);
        return res.status(400).send({
            type: "RXERROR",
            message: "Invalid params",
            errors: error
        });
    }

    try{
        // delete project domain on the base of id
        await ProjectDomain.destroy({
            where:{
                id: input.id
            }
        })
    }catch(err){
        // return 400
        return res.status(400).send({
            type:"RXERROR",
            message: "Unable to delete!"
        })
    }
    // return success 
    return res.status(200).send({
        type:"RXSUCCESS",
        message: "Domain removed successfully!"
    })
    
    }

    /**
     * get project domains detail on the base of project_uid
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getProjectDomains(req, res) {
    // request body
    let input = req.body;
    let user_id = req.authUser.user_id
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

    let orderBy = isset(input.orderBy, "DESC");
    let limit = parseInt(isset(input.limit, 10));
    let offset = 0 + (isset(input.page, 1) - 1) * limit;
    if (offset < 1) {
        offset = 0;
    }

    let search = isset(input.search, null);
    let customWhere={};

    if(search != null) {
        customWhere={
            domain:{
                [Op.like]: (typeof search!="undefined"?search+"%":"%")
            }
        }
    }else{
        customWhere = {}
    }
    let projectData = await Project.findOne({
        where : {
            project_uid : input.project_uid
        }
    })
    if (!projectData) {
        return res.status(400).send({
            type: "RXERROR",
            message: "Please enter valid project_uid input"
        });
    }
    const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: projectData.id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
    // find project_domain detail 
    let data = await ProjectDomain.findAndCountAll({
        include : [
            {
                model : Project,
                attributes : [],
                as:"project",
                where :{project_uid : input.project_uid},
            }
        ],
        where: customWhere,
        limit: limit,
        offset: offset,
        order: [['id', orderBy]]
    })
    // return success response
    return res.status(200).send({
        type: "RXSUCCESS",
        message: "Data Fetched Successfully!",
        total:data.count,
        data:data['rows']
    })
    }
};

