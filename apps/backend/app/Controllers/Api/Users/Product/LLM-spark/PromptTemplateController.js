const { User, Organization, ProjectUsage, ProjectDomain, Invitation, OrganizationMember, PromptHistory, Project, ProjectMember, ProjectIndex, ProjectSetting, ProjectKey, ProjectFile, UsageData, UsageLimit, ShareLinkIntegrationSetting, sequelize , Deployment, PromptTemplate} = require("../../../../../Models");
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

module.exports = class PromptTemplateController {

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * 
     * 
     */

    async getAllPromptTemplates(req, res) {
        // request body
        let input = req.body;
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
                title: {
                    [Op.like]: (typeof search != "undefined" ? search + "%" : "%")
                }
            }
        } else {
            customWhere = {}
        }

        // Get projects data
        const data = await PromptTemplate.findAndCountAll({
            distinct: true,
            order: [['id', orderBy]],
            limit: limit,
            offset: offset,
            where: customWhere
        });
        // return 200
        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Fetched Successfully!",
            total: data.count,
            data: data['rows']
        })
    }

}