const { User,DeploymentRequest, Organization, ProjectUsage, ProjectDomain, Invitation, OrganizationMember, PromptHistory, Project, ProjectMember, ProjectIndex, ProjectSetting, ProjectKey, ProjectFile, UsageData, UsageLimit, ShareLinkIntegrationSetting, sequelize , Deployment } = require("../../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
let AWS = require('aws-sdk');
let mime = require('mime')
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require("openai");
let { syncContactToChatBotList, updateBrevoContact } = require(baseDir() + "helper/syncContactToBrevo");
let { sendEmailNotification } = require(baseDir() + "helper/email");
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, getProjectData,encrypt, getIpDetail, userPrivilege, checkOrganizationLimit, increaseLimit, notifyOnDiscord } = require(baseDir() + "helper/helper");
// let { sessionMiddleware } = require('../../Middlewares/Auth')
let Sequelize = require("sequelize");
const Op = Sequelize.Op;
const QueryTypes = Sequelize.QueryTypes;

module.exports = class DeployedPromptController {

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * 
     * 
     */

    async deployPrompt(req, res) {
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id
        let result = validateParameters(["project_uid","nodes","provider","prompt","model"], input);
        // check parameter validation
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        let prompt_variables = isset(input?.prompt_variables , null)
        let name = isset(input?.name , null)

        const project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "please enter valid project_uid",
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
        if (typeof input.settings != "object" || input.settings == null) {
            return res.status(400).send({
                type: "RXERROR",
                message: "please enter valid settings with valid json",
            })
        }
        const myAppId = uuidv4();
        let deployment_uid = myAppId.substr(0, 8) + myAppId.substr(8, 4) + myAppId.substr(12, 4) + myAppId.substr(16, 4) + myAppId.substr(20);
        let data;

        try {
            // Create the projects
            data = await Deployment.create({
                prompt_variables: prompt_variables,
                project_id: project_id,
                nodes: input.nodes,
                provider: input.provider,
                deployment_uid: deployment_uid,
                settings : input.settings,
                prompt : input.prompt,
                name : name,
                model : input.model
            });

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

    async getAllDeployPrompt(req, res) {
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

        const project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "please enter valid project_uid",
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
        let orderBy = isset(input.orderBy, "DESC");
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }

        let search = isset(input.search, null);
        let customWhere = {};

        if (search != null) {
            customWhere = {
                prompt: {
                    [Op.like]: (typeof search != "undefined" ? search + "%" : "%")
                }
            }
        } else {
            customWhere = {}
        }

        // Get projects data
        const data = await Deployment.findAndCountAll({
            distinct: true,
            order: [['id', orderBy]],
            limit: limit,
            offset: offset,
            where: {
                ...customWhere,
                project_id : project_id
            }
        });
        // return 200
        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Fetched Successfully!",
            total: data.count,
            data: data['rows']
        })
    }

    async getMyDeployPrompt(req, res) {
        // request body
        let input = req.body;
        let result = validateParameters(["deployment_uid"], input);
        // check parameter validation
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        // Get projects data
        const data = await Deployment.findOne({
            where: {
                deployment_uid : input.deployment_uid
            }
        });
        if (!data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Data not found"
            });
        }
        // return 200
        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Fetched Successfully!",
            data: data
        })
    }

    async updateDeployPrompt(req, res) {
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
 
         const project_data = await getProjectData(input.project_uid)
         if (!project_data) {
             return res.status(400).send({
                 type: "RXERROR",
                 message: "please enter valid project_uid",
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
         let deployed_prompt_data = await Deployment.findOne({
            where: {
                id: input.id,
                project_id : project_id
            }
        })
        if (!deployed_prompt_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "No data to update",
            })
        }
        try {
            await Deployment.update(input, {
                where: {
                    id: input.id,
                    project_id : project_id
                }
            })
            deployed_prompt_data = await Deployment.findOne({
                where: {
                    id: input.id,
                    project_id : project_id
                }
            })
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "data updated successfully",
                data: deployed_prompt_data
            });
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong"
            });
        }
    }

    async deleteDeployPrompt(req, res) {
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

        const project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "please enter valid project_uid",
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
        let deployed_prompt_data = await Deployment.findOne({
           where: {
               id: input.id,
               project_id : project_id
           }
       })
       if (!deployed_prompt_data) {
           return res.status(400).send({
               type: "RXERROR",
               message: "No data to update",
           })
       }

        try {
            let data = await Deployment.destroy({
                where: {
                    id: input.id,
                    project_id : project_id
                }
            })
            return res.status(200).send({ type: "RXSUCCESS", message: "data deleted successfully" })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong"
            });
        }
    }

    async getRequestLogs(req,res){
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
        let project_data = await getProjectData(input.project_uid)
        if (!project_data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Please enter valid project_uid input"
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
        let orderBy = isset(input.orderBy, "DESC");
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }

        let search = isset(input.search, null);
        let customWhere = {};

        if (search != null) {
            customWhere.tags = {[Op.like]: (typeof search != "undefined" ? "%" + search + "%" : "%")}
        }

        let compare_by = isset(input.compare_by, null);
        if (compare_by != null) {
            let validate = await this.validateReq(compare_by)
            if (validate != "valid") {
                return res.send(validate)
            }
            for (let i = 0; i < compare_by.length; i++) {
                const item = compare_by[i];
                customWhere[item.fieldName] = {
                    [Op[item.operator]]: item.value,
                };                                                                                                  
            }
            
        }
        try {
            let data = await DeploymentRequest.findAndCountAll({
                where : {
                    project_id : project_id,
                    ...customWhere
                },
                limit:limit,
                offset : offset,
                order : [["id",orderBy]]
            })
            return res.status(200).send({
                type: "RXSUCCESS",
                message: "Data fetch successully",
                count : data.count,
                data : data["rows"]
            });
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went to be wrong"
            });
        }
    }

    async analytics(req, res) {
        // request input
        let input = req.body;
        let user_id = req.authUser.user_id
        // validate input parameters
        let result = validateParameters(["filter","chart_filter","project_uid"], input);
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
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // set filter
        let filter = input.filter 
        let array = [];
        let upperAttribute;
        let lowerAttribute
        let current_date;
        let upperWhere;
        let lowerWhere;
        let searchLimit;
    
        // set values for days filter
        if (filter == 'hours') {
            array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            upperAttribute = "DAY"
            lowerAttribute = "HOUR"
            upperWhere = "DAY"
            lowerWhere = "HOUR"
            current_date = new Date().getHours();
            searchLimit = 1;
        }

        // set values for days filter
        else if (filter == 'days') {
          array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          upperAttribute = "MONTH"
          lowerAttribute = "DAY"
          upperWhere = "MONTH"
          lowerWhere = "DAY"
          current_date = new Date().getDate();
          searchLimit = 1;
    
        }
    
        // set values for months filter
        else if (filter == 'months') {
          array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          upperAttribute = "YEAR"
          lowerAttribute = "MONTH"
          upperWhere = "YEAR"
          lowerWhere = "MONTH"
          current_date = new Date().getMonth() + 1;
          searchLimit = 1;
        }
    
        // set values for years filter
        else if (filter == 'years') {
          array = [0, 0, 0, 0, 0];
          upperAttribute = "YEAR"
          lowerAttribute = "YEAR"
          upperWhere = "YEAR"
          lowerWhere = "MONTH"
          current_date = new Date().getFullYear();
          searchLimit = 5;
        }

        else{
            return res.status(400).send({
                type : "RXERROR",
                message : "Please enter correct filter value input"
            })
        }
        let attributes= [] , key = ""
        switch (input.chart_filter) {
            case "TotalExecutions":
                attributes = [[sequelize.fn('COUNT', '*'), 'total_execution']]
                key = "total_execution"
                break;
            case "TotalCostsPerProviders":
                attributes = [[sequelize.literal('SUM(cost) / SUM(providers)'), 'total_cost_per_provider']]
                key ="total_cost_per_provider"
                break;
            case "TotalCosts":
                attributes = [[sequelize.fn('FORMAT', sequelize.fn('SUM', sequelize.col('DeploymentRequest.cost')), 2), 'total_cost']];
                key = "total_cost";
                break;
            case "TotalTokens":
                attributes = [[sequelize.fn('SUM',sequelize.col('DeploymentRequest.total_tokens')), 'total_token']]
                key = "total_token"
                break;
            case "AvgExecutionDuration":
                attributes = [[sequelize.fn('AVG', sequelize.col('response_time')), 'avg_execution_duration']]
                key = "avg_execution_duration"
                break;
            default:
                return res.status(400).send({
                    type : "RXERROR",
                    message:"please provide valid chart_filter input value"
                })
                break;
        }
    
        // get records form users table based on values
        let project_response = await DeploymentRequest.findAll({
          attributes: [
            [Sequelize.fn(`${upperAttribute}`, Sequelize.col("created_at")), "u"],
            [Sequelize.fn(`${lowerAttribute}`, Sequelize.col("created_at")), "l"],
            ...attributes
          ],
          where: {
            created_at: {
              [Op.gte]: Sequelize.literal(`NOW() + INTERVAL 1 ${lowerWhere} - INTERVAL ${searchLimit} ${upperWhere} `)
            },
            project_id : project_id
          },
          group: ["u", "l"],
        })
        let data = await this.formatData(project_response,current_date,array,key);
        // return success response
        let dataobject = {}
        dataobject[key] = data
        return res.status(200).send({ type: 'RXSUCCESS', message: 'prompt_data chart detail', data : dataobject})
    }

    async getAnalyticsStatCount(req, res) {
        // request input
        let input = req.body;
        let user_id = req.authUser.user_id
        // validate input parameters
        let result = validateParameters(["filter","project_uid"], input);
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
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // set filter
        let filter = input.filter 
        let array = [];
        let upperAttribute;
        let lowerAttribute
        let current_date;
        let upperWhere;
        let lowerWhere;
        let searchLimit;
    
        // set values for days filter
        if (filter == 'hours') {
            array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            upperAttribute = "DAY"
            lowerAttribute = "HOUR"
            upperWhere = "DAY"
            lowerWhere = "HOUR"
            current_date = new Date().getHours();
            searchLimit = 1;
        }

        // set values for days filter
        else if (filter == 'days') {
          array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          upperAttribute = "MONTH"
          lowerAttribute = "DAY"
          upperWhere = "MONTH"
          lowerWhere = "DAY"
          current_date = new Date().getDate();
          searchLimit = 1;
    
        }
    
        // set values for months filter
        else if (filter == 'months') {
          array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          upperAttribute = "YEAR"
          lowerAttribute = "MONTH"
          upperWhere = "YEAR"
          lowerWhere = "MONTH"
          current_date = new Date().getMonth() + 1;
          searchLimit = 1;
        }
    
        // set values for years filter
        else if (filter == 'years') {
          array = [0, 0, 0, 0, 0];
          upperAttribute = "YEAR"
          lowerAttribute = "YEAR"
          upperWhere = "YEAR"
          lowerWhere = "MONTH"
          current_date = new Date().getFullYear();
          searchLimit = 5;
        }
    
    
        // get records form users table based on values
        let project_response = await DeploymentRequest.findOne({
          attributes: [
            [sequelize.fn('FORMAT', sequelize.fn('SUM', sequelize.col('DeploymentRequest.cost')), 2), 'total_cost'],
            [sequelize.fn('COUNT', '*'), 'total_requests'],
            [sequelize.fn('AVG', sequelize.col('DeploymentRequest.response_time')), 'avg_response_duration'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status_code = 200 THEN 1 END')), 'total_success']
          ],
          where: {
            created_at: {
              [Op.gte]: Sequelize.literal(`NOW() + INTERVAL 1 ${lowerWhere} - INTERVAL ${searchLimit} ${upperWhere} `)
            },
            project_id : project_id
          },
        })
        // return success response
        return res.status(200).send({ type: 'RXSUCCESS', message: 'prompt_data chart detail', data : project_response})
    }

    async formatData(response,current_date,data,key){
    logInfo(JSON.stringify(response))
    const array=data;
    for (let i = 0; i < response.length; i++) {
        // logInfo(JSON.stringify(response[i]))

        // index to be updated
        let updateIndex = current_date - response[i].dataValues.l
        logInfo(updateIndex ,current_date,response[i].dataValues.l ,response[i].dataValues[key]);
        // check if index is positive
        if (updateIndex >= 0) {
        array[updateIndex] = +response[i].dataValues[key];
        }

        //check if index is negative
        if (updateIndex < 0) {

        // convert negative index to positive
        let toUpdate = updateIndex * -1

        // logic to update negaive indexs from back side
        let len = array.length

        // find index to be updated for negative values
        let toUpdateIndex = len - toUpdate

        // update to respective
        array[toUpdateIndex] = +response[i].dataValues[key];
        }
    }
    // logInfo("\n\n\n\n");
        return array;
    }

    async validateReq(arr){
        const validFieldNames = ['total_tokens', 'cost', 'providers', 'response', 'response_time', 'status_code'];
        const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like'];

        const objectSchema = Joi.object({
            fieldName: Joi.string().valid(...validFieldNames).required().messages({
                "any.required": `fieldName cannot be blank`,
                "string.empty": `fieldName cannot be blank`,
            }),
            operator: Joi.string().valid(...validOperators).required().messages({
                "any.required": `operator cannot be blank`,
                "string.empty": `operator cannot be blank`,
            }),
            value: Joi.any().required().messages({
                "any.required": `value cannot be blank`,
                "string.empty": `value cannot be blank`,
            }),
        });
        let schema = Joi.array().items(objectSchema).required().messages({
            "any.required": `compare_by cannot be blank`,
            "string.empty": `compare_by cannot be blank`,
        })

        // Validate the data
        const { error, value } = schema.validate(arr,{ abortEarly: false ,allowUnknown: true});
        // logInfo(schema.validate(arr,{ abortEarly: false ,allowUnknown: true}));

        if (error) {
            let customError = {}
            error.details.forEach((item, i) => {
                customError[item.context.key] = item.message.replace(/"/g, '')
            })
            return customError
        }
        return "valid"
    }
}