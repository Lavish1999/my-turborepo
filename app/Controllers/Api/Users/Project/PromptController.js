const { Prompt ,Session,Project,SessionMessage,ProjectSetting,ZapierIntegrationsSetting,Organization,ProjectKey,Integration,SlackIntegrationsSetting,DiscordIntegrationsSetting,ChatbotIntegrationsSetting} = require("../../../../Models");
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters,decrypt, getIpDetail } = require(baseDir() + "helper/helper");
let Sequelize = require("sequelize");
const { v4: uuidv4 } = require('uuid');
const Op = Sequelize.Op;

module.exports = class PromptController {
    /**
     * Get prompts detail on the base of integration_id
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getPrompt(req,res){
        // request body
        let input = req.body;
        // validate input parameters
        let result = validateParameters(["integration_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        // get prompt detail on the base of integration_id
        let data = await Prompt.findAll({
            where:{
                integration_id:input.integration_id
            }
        });
        // if prompts data found return 200
        if(data){
            return res.status(200).send({type:"RXSUCCESS",message:"Get prompt data",data:data})
        }else{
            // if prompts data not found , return 400
            return res.status(400).send({type:"RXERROR",message:"Something went wrong"})
        }
    }
}