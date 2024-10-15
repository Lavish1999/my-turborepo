const { User, Organization, Invitation, OrganizationMember, Project, ProjectMember,ProjectIndex,ProjectSetting,ProjectKey,ProjectFile } = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
const { v4: uuidv4 } = require('uuid');
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, getIpDetail,userPrivilege,loadEmailTemplate } = require(baseDir() + "helper/helper");
// let { sessionMiddleware } = require('../../Middlewares/Auth')
let Sequelize = require("sequelize");
const Op = Sequelize.Op;
const nodemailer = require('nodemailer')

module.exports = class ProjectMemberController {
    
    /**
     * get project members detail on the base of project_uid
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
            include:[{
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
        // return 200
        return res.status(200).send({type:"RXSUCCESS",message:"Get all project member",total:data.count,data:data['rows']});
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
        // find projects detail on the base of project_uid to get project_id
        let data = await Project.findOne({
            where:{
                project_uid:project_uid
            }
        });
        let project_id = data.id

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
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

        try{
            // remove the project member on the base of id and project_id
            await ProjectMember.destroy({
                where: {
                    project_id: project_id,
                    id: input.member_id
                }
            })
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
            where:{
                project_uid:input.project_uid
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
        // check user privilege
        const permission = await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id: data.id},allowedRole:["owner"],key:data.project_uid})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        // check if invitation already send     
        let sentCheck = await Invitation.findOne({
            where: {
                project_id: data.id,
                email: input.email
            }
        })
        if (sentCheck) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invitation already sent!"
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
        let htmlMessage = await loadEmailTemplate("inviteEmail.ejs", {
            from : name,
            hash : hash,
            project : data.name
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
        // return 200
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong",
            })
        }
    }

    async addProjectMemeberViaHash(req, res) {

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
            hash: input.hash
           }
        })

        if (data == null) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid Hash"
            })
        }
        let user = await User.findOne({
            where : {
                email : data.sent_to
            }
        })

        //update status to accepted
        await Invitation.update({
            status:"accepted"
        },{
            where:{
                hash: input.hash
            }
        })


        let entities = await ProjectMember.create({
            user_id: user.id,
            project_id: data.project_id,
            role : data.role
        })

        return res.status(200).send({
            type:"RXSUCCESS",
            message:"Added to Project successfully",
            data:entities
        })
    }
}
