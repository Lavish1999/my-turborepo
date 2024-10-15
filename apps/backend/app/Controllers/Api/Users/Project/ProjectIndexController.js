const { User, Organization, Invitation, OrganizationMember, Project, ProjectIndex } = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, getIpDetail } = require(baseDir() + "helper/helper");
let Sequelize = require("sequelize");
const Op = Sequelize.Op;


module.exports = class ProjectIndexController {

    /**
     * Create project_index
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async createIndex(req, res) {
        // request body
        let input = req.body;
        // validate input parameters
        let result = validateParameters(["project_id", "name", "connector", "rebuild"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let timestamp,duration;

        if(input.rebuild == "yes") {
            let check = validateParameters(["duration"], input);
            if (check != 'valid') {
                let error = formatJoiError(check.errors);
                return res.status(400).send({
                    type: "RXERROR",
                    message: "Invalid params",
                    errors: error
                });
            }
            timestamp = moment().add('hours', parseInt(input.duration)).format("YYYY-MM-DD HH:mm:ss");
            duration = parseInt(input.duration)
        }else {
            timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
            duration = null;
        }


        let entity;
    
        try {
            // create project_index
            entity = await ProjectIndex.create({
                project_id: input.project_id,
                name: input.name,
                connector: input.connector,
                rebuild: input.rebuild,
                rebuild_duration: duration,
                last_updated_index: timestamp,
                status: 'building'
            })
        } catch (err) {
            logInfo(err)
            // return 400 
            return res.status(400).send({
                type: "RXERROR",
                message: "Oops! Something went wrong"
            })
        }

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Created Successfully!",
            data: entity
        })
    }

    /**
     * Update project_index on the base of id
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async updateIndex(req, res) {
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

        let updateStatement = {};

        if(typeof input.name != "undefined"){
            updateStatement.name = input.name;
        }
        if(typeof input.connector != "undefined"){
            updateStatement.connector = input.connector;
        }
    
        
        // set rebuild yes if duration passed
        if(typeof input.duration != "undefined"){
            updateStatement.rebuild_duration = input.duration;
            updateStatement.rebuild = "yes";
        }
        
        if(typeof input.rebuild != "undefined"){
            if(input.rebuild == "no") {
                updateStatement.rebuild_duration = null
                updateStatement.rebuild = input.rebuild;
            }else{
                if(typeof input.duration == "undefined") {
                    return res.status(400).send({
                        type:"RXERROR",
                        message:"duration is required field!"
                    })
                }
                updateStatement.rebuild = input.rebuild;
                updateStatement.rebuild_duration = input.duration;
            }
           
        }

        //todo update last_updated_index with duration
        try{
            await ProjectIndex.update(updateStatement, {
                where:{
                    id: input.id
                }
            })
        }catch(err){
            // return 400
            return res.status(400).send({
                type:"RXERROR",
                message:"Oops! some error occured"
            })
        }
        // return 200
        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Data updated successfully"
        })
    }

    /**
     * delete project index on the base of id
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async deleteIndex(req, res) {
        // request body
        let input =  req.body;
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
            // delete project_index on the base of id
            await ProjectIndex.destroy({
                where: {
                    id: input.id
                }
            })
        }catch(err) {
            // return 400 
            return res.status(400).send({
                type:"RXERROR",
                message: "Something went wrong"
            })
        }
        // return 200
        return res.status(200).send({
            type:"RXSUCCESS",
            message: "Index deleted successfully"
        })
    }
};
