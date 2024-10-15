const { User, Organization, Invitation, OrganizationMember, sequelize, Project,App } = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
const fetch = require('node-fetch');
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, decrypt,encrypt,getIpDetail,userPrivilege,loadEmailTemplate } = require(baseDir() + "helper/helper");
// let { sessionMiddleware } = require('../../Middlewares/Auth')
let Sequelize = require("sequelize");
const nodemailer = require('nodemailer')
const Op = Sequelize.Op;
const {OpenAI} = require("openai");

module.exports = class OrganizationController {
    /**
     * create organization
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async createOrganization(req, res) {
        // request body
        let input = req.body;
        let user_id = req.authUser.user_id;
        let name = input.name;
        let openai_key = input.openai_key;
        // check parameter validation
        let result = validateParameters(["name","openai_key"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let check_organization = await Organization.findOne({
            where:{
                created_by:user_id
            }
        })

        if(check_organization){
            return res.status(400).send({type:"RXERROR",message:"You can't create more than one organization"})
        }
        // encrypt openai_key and store in database
        let encrypted_data  = await encrypt(openai_key);

        //validate openai key
        const openai = new OpenAI({
            apiKey: openai_key
        });
        
        try{
            const response = await openai.models.retrieve('text-davinci-003')

            if (response.status === 200) {
                logInfo("api key is valid")
            }
        }catch(err){
            return res.status(400).send({
                type:"RXERROR",
                message:"Please pass valid openai_key!"
            })
        }
       
       
        let data;
        try {
            // create data in organization
            data = await Organization.create({
                name: name,
                openai_key: encrypted_data,
                created_by:user_id,
            });

            await OrganizationMember.create({
                role: "owner",
                user_id: user_id,
                organization_id:data.id
            });
        } catch (err) {
            let error = err;
            return res.status(400).send({
                type: "RXERROR",
                message: "Unable to create data!",
                errors: error
            })
        }

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data Created Successfully!",
            data: data
        })
    }

    async inviteOrganizationMember(req, res) {

        let input = req.body;
        let user_id = req.authUser.user_id;
        const name = req.authUser.User.name
        
        let result = validateParameters(["email", "role", "organization_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        const permission =await userPrivilege({type :'organization',searchParam :{user_id:user_id,organization_id: input.organization_id},allowedRole:["owner","viewer"]})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // check if invitation already send 
        let sentCheck = await Invitation.findOne({
            where: {
                organization_id: input.organization_id,
                email: input.email
            }
        })
        if (sentCheck) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invitation already sent!"
            })
        }

        // let user = await User.findOne({
        //     where: {
        //         email: input.email
        //     }
        // })

        // if (user == null) {
        //     return res.status(400).send({
        //         type: "RXERROR",
        //         message: "No user found for this Email!"
        //     })
        // }

        // create hash
        let string = input.email + user_id + Date.now()
        let hash = md5(string)

        // create invitation
        let entities = await Invitation.create({
            sent_by: user_id,
            sent_to: input.email,
            organization_id: input.organization_id,
            email: input.email,
            type:'organization',
            role: input.role,
            hash: hash,
            status: "pending"
        })

        const maildata = config('mail')
      // logInfo(maildata);
      let transporter = nodemailer.createTransport(maildata);
      
      // send mail with defined transport object
      let htmlMessage = await loadEmailTemplate("inviteEmail.ejs", {
        name : name
      });
        let info = await transporter.sendMail({
          from:"noreply@yourgpt.ai", // sender address
          to: input.email, // list of receivers
          subject: "Your reset password request", // Subject line
          html: htmlMessage, // plain text body
        });

        if (info.messageId) {

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Invitation Sent Successfully",
            data: entities
        })

    }
    }

    async addOrganizationMemeberViaHash(req, res) {

        let input = req.body;

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
            sent_to: req.authUser.User.email
           }
        })

        if (data == null) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid Hash"
            })
        }
        let user = await User.findOne({
            where:{
                email: data.sent_to
            }
        });
        
        if(user == null) {
            return res.status(400).send({
                type:"RXERROR",
                message:"No User Found!"
            })
        }


        //update status to accepted
        await Invitation.update({
            status:"accepted"
        }, {
            where:{
                hash: input.hash
            }
        })


        let entities = await OrganizationMember.create({
            user_id: user.id,
            organization_id: data.organization_id
        })

        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Added to organization successfully",
            data:entities
        })

    
    }

    async getMyOrganizations(req, res) {

        let input = req.body;
       

        let orderBy = isset(input.orderBy, "DESC");
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }

        let user_id = req.authUser.user_id;
        let search = isset(input.search, null);
        let customWhere ;

        if(search != null) {
            customWhere={
                name:{
                    [Op.like]: (typeof search!="undefined"?search+"%":"%")
                },
          
            }
        }else{
            customWhere = null
        }
    
        let data = await Organization.findAndCountAll({
            subQuery: false,
            attributes:["id","created_by","name",
            [Sequelize.literal("CASE WHEN openai_key IS NULL THEN 'false' ELSE 'true' END"), "has_openai_key"],
          //  [sequelize.literal(`(SELECT role FROM organization_members WHERE organization_members.organization_id = Organization.id and organization_members.user_id=${user_id}  LIMIT 1)`), 'my_role'],
          
            [sequelize.col('OrganizationMembers.role'), 'role'],
            [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('OrganizationMembers.id'))), 'member_count'],
            [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('OrganizationProjects.id'))), 'project_count']
            ],        
            include:[
                {
                    as:'OrganizationProjects',
                    attributes:[],
                    model:Project
                },
                {
                    as:'OrganizationMembers',
                    attributes:[],
                    model:OrganizationMember,
                    where:{
                        user_id:user_id
                    }
                }
            ],
            where: customWhere,
            group: ['Organization.id', 'OrganizationMembers.role'],        
            order:[['id', orderBy]],
            limit: limit,
            offset: offset,
        })
        if(data['rows'].length == 0){
            return res.status(400).send({
                type:"RXERROR",
                message:"No Records Found!"
            })
        }
        let totalCount = data.count.length
        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Data fetched successfully",
            total:totalCount,
            data:data['rows']
        })
    }

    async updateOrganization(req, res) {

        let input = req.body;
        let result = validateParameters(["organization_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        let user_id = req.authUser.user_id;
        let name = isset(input.name, null)
        let openai_key = isset(input.openai_key, null)
        const permission =await userPrivilege({type :'organization',searchParam :{user_id:user_id,organization_id:input.organization_id},allowedRole:["owner"]})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        let updateStatement = {};

        // validate openai key

        if(openai_key != null) {

            const openai = new OpenAI({
                apiKey: openai_key,
            });
            
            try{
                const response = await openai.retrieveEngine('text-davinci-003');

                if (response.status === 200) {
                    updateStatement.openai_key = openai_key; 
                }
            }catch(err){
                return res.status(400).send({
                    type:"RXERROR",
                    message:"Please pass valid openai_key!"
                })
            }
            updateStatement.openai_key  = await encrypt(openai_key);
        }

        if (name != null) {
            updateStatement.name = name;
        }
        
        
        try {
            logInfo(updateStatement)
            await Organization.update(updateStatement, {
                where: {
                    id: input.organization_id
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
            message:"Data Updated Successfully!"
        })
    }

    async removeOrganizationMember(req, res) {

        let input = req.body;
        let user_id = req.authUser.user_id;
        let result = validateParameters(["organization_id","member_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        const permission =await userPrivilege({type :'organization',searchParam :{user_id:user_id,organization_id:input.organization_id},allowedRole:["owner,viewer"]})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        try{
            await OrganizationMember.destroy({
                where: {
                    organization_id: input.organization_id,
                    id: input.member_id
                }
            })
        }catch(err){
            return res.status(400).send({
                type:"RXERROR",
                message:"Oops! Something went wrong!"
            })
        }

        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Member Removed Successfully!"
        })
        
    }

    async getOrganizationMembers(req, res) {

        let input = req.body;
        let organization_id = input.organization_id;

        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
          offset = 0;
        }

        let result = validateParameters(["organization_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        
        let user_id = req.authUser.user_id
        const permission =await userPrivilege({type :'organization',searchParam :{user_id:user_id,organization_id: input.organization_id},allowedRole:["owner"]})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        let data = await OrganizationMember.findAndCountAll({ 

            include:[
                {
                    attributes:["id","name","email","username"],
                    model: User,
                    as:"Member"
                }
            ],
            where:{
                organization_id:organization_id,
            },
            limit: limit,
            offset: offset
        })

        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Data Fetched Successfully!",
            total:data.count,
            data:data['rows']
        })
    }

    async getOrganizationDetail(req, res) {

        let input = req.body;

        let result = validateParameters(["organization_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }
        let user_id = req.authUser.user_id
        const permission =await userPrivilege({type :'organization',searchParam :{user_id:user_id,organization_id: input.organization_id},allowedRole:["owner"]})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        let data = await Organization.findOne({
            include:[
                {
                    attributes: ["id","name","email","username","firebase_uid","createdAt"],
                    model:User,
                    as: "user"
                },
                {    
                    model: OrganizationMember,
                    as:"OrganizationMembers"
                },
                {
                    model: Project,
                    as: "OrganizationProjects"
                }
            ],
            where:{
                id: input.organization_id
            }
        })

        if(data == null) {
            return res.status(400).send({
                type: "RXERROR",
                message: "No Records Found!"
            })
        }

        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Data Fetched Successfully!",
            data: data
        })

    }

    async deleteOrganization(req, res) {

        let input = req.body;
        let user_id = req.authUser.user_id
        let result = validateParameters(["organization_id"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        const permission =await userPrivilege({type :'organization',searchParam :{user_id:user_id,organization_id: input.organization_id},allowedRole:["owner"]})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

        let project = await Project.findOne({
            where:{
                organization_id: input.organization_id
            }
        })

        if(project != null) {
            return res.status(400).send({
                type:"RXERROR",
                message: "projects exists for this organization"
            })
        }

        try{
            await Organization.destroy({
                where:{
                    id: input.organization_id
                }
            })

        }catch(err) {
            return res.status(400).send({
                type:"RXERROR",
                message: "Unable to delete data"
            })
        }

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Organization removed successfully!"
        })
        


    }
};
