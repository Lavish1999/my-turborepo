const { Subscription,Invoice,Transaction,DiscountSubscription,InvoiceLineItem } = require("../../../../Models");
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, getIpDetail,loadEmailTemplate,getProject,userPrivilege } = require(baseDir() + "helper/helper");
module.exports = class InvoiceController {

    /**
     * Get invoice details by project_uid
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getInvoiceByProjectId(req, res) {
        // request body
        const input = req.body
        let user_id = req.authUser.User.id;
        let project_uid = input.project_uid;

        let orderBy = isset(input.orderBy, "DESC");
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }
        // validate the params
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
        let project_data = await getProject(res,project_uid);
        let project_id = project_data.id;
        // if projects detail not found return error
        if (!project_data) {
            return res.status(400).send({type:"RXERROR",message:"Invalid project_uid"})
        }
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // get invoice detail with subscription
        const data = await Invoice.findAndCountAll({
            include : [
                {
                    model : Subscription,
                    where : {
                        project_id : project_id,
                        user_id : user_id,
                    }
                },
                {
                    model : DiscountSubscription,
                },
            ],
            where : {
                status : "paid"
            },
            limit: limit,
            offset: offset,
            order: [['created_at', orderBy]]
        })

        if (data["rows"] == 0) {
            // return 400
            return res.status(400).send({
                type : "RXERROR",
                message :"Data not found"
            })
        }
        // return 200
        return res.status(200).send({
                type : "RXSUCCESS",
                message :"Get invoice data",
                total:data.count,
                data : data["rows"]
            })

    }

    /**
     * Get invoice detail on the base of organization_id
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getInvoiceByOrganization(req, res) {
        // request body
        const input = req.body
        let user_id = req.authUser.user_id;

        let orderBy = isset(input.orderBy, "DESC");
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }
        // validate the params
        let result = validateParameters(["organization_id","app_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        const subscriptionData = await Subscription.findOne({
            where :{
                app_id : input.app_id,
                organization_id : input.organization_id,
                user_id : user_id,
            },
            order : [['created_at','desc']]
        })
        //  get invoice detail with subscription
        const data = await Invoice.findAndCountAll({
            include : [
                {
                    model : InvoiceLineItem
                },
            ],
            where : {
                subscription_id : subscriptionData.id
            },
            distinct : true,
            limit: limit,
            offset: offset,
            order: [['created_at', orderBy]]
        })

        if (data["rows"] == 0) {
            // return 400
            return res.status(400).send({
                type : "RXERROR",
                message :"data not found"
            })
        }
        // 200
        return res.status(200).send({
                type : "RXSUCCESS",
                message :"data fatch successfully",
                total:data.count,
                data : data["rows"]
            })

    }
    
}