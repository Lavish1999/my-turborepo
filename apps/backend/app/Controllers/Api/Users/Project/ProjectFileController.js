const { User, Organization, Invitation, OrganizationMember, Project, ProjectFile,UsageData, ProjectSetting } = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
let md5 = require("md5");
let { formatJoiError, ucfirst, isset, userPrivilege, validateParameters, getIpDetail,getProject,addToIndexQueue,checkOrganizationLimit,increaseLimit,deleteQdrantDoc } = require(baseDir() + "helper/helper");
let Sequelize = require("sequelize");
let AWS = require('aws-sdk');
const Op = Sequelize.Op;
const { projectExtraSettingApiValidator } = require(baseDir() + "validator/ChatbotValidator");


module.exports = class ProjectController {


  async getProjectFileSignedUrl(req, res) {

    // Input & validate
    let input = req.body;
    let user_id = req.authUser.user_id;
    logInfo("getS3SignedUrlForProjectFile input log", input);


    let result = validateParameters(["file_name","project_uid"], input);

    if (result != 'valid') {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error
      });
    }
    let fileName = input.file_name;
    let project_uid = input.project_uid;
    fileName = fileName.replace(/ /g, "-");

    // call getProject function to get project_id
    let project_data = await getProject(res,project_uid);
    let project_id = project_data.id;
    // check user privilege
    const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner','editor'],key:input.project_uid})
    logInfo("permission",permission);
    if (permission !== 'valid') {
        return res.status(400).send({
            type: "RXERROR",
            message: permission.message,
        })
    }

    AWS.config.update({
      accessKeyId: config("aws").accessKeyId, // Access key ID
      secretAccessKey: config("aws").secretAccessKey, // Secret access key
      region: config("aws").region //Region
    });

    // Singed URL
    let filename = Math.floor(Date.now() / 1000) + "-" + Math.floor(Math.random() * 10000) + "-" + fileName
    let modifiedFileName = "projects/"+project_uid+"/data/" + filename;
    let s3 = new AWS.S3({
      signatureVersion: 'v4'
    });

    // Singed
    let signedUrl = s3.getSignedUrl('putObject', {
      Bucket: config("aws").bucketName,
      Key: modifiedFileName,
      Expires: 3600
    });

    logInfo('presigned url: ', signedUrl);

    // Return success
    return res.status(200).send({ "type": "RXSUCCESS", "data": { "url": signedUrl, "filename": filename } });
  }

    async uploadFile(req, res) {
        let input = req.body;    
        let user_id = req.authUser.user_id

        let result = validateParameters(["file_name","original_filename","project_uid","app_id"], input);
        if (result != 'valid') {
          let error = formatJoiError(result.errors);
          return res.status(400).send({
            type: "RXERROR",
            message: "Invalid params",
            errors: error
          });
        }
        let original_filename = input.original_filename;
        let filename = input.file_name;
        let project_uid = input.project_uid;
        let app_id = input.app_id;
        let extra_settings = input?.extra_settings;
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

        let project_data = await Project.findOne({
          where:{
            project_uid:input.project_uid
          },
          order: [['id', 'DESC']]
        })
        if(!project_data){
          return res.status(400).send({type:"RXERROR",message:"Please provide a valid project_uid"})
        };
        let project_id = project_data.id;
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let usage_type,valdateLimit=false;
        let organization_id = project_data.organization_id
        switch (app_id) {
            case "1":
                usage_type = "document"
                valdateLimit=true;
                break;
            case "2":
                usage_type = "document"
                valdateLimit=true;
                break;
            case "4":
                usage_type = "document"
                valdateLimit=true;
                break;
            default:
              usage_type = "document"
              valdateLimit=true;
                break;
        }
        
        if(valdateLimit){
          
          const data = await checkOrganizationLimit({organization_id : organization_id , app_id : app_id , project_id : null , usage_type : usage_type})
          if(data?.data < 1){
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
        let { accessKeyId, secretAccessKey, region, bucketName } = config('aws');
        AWS.config.update({
            accessKeyId: accessKeyId, // Access key ID
            secretAccessKey: secretAccessKey, // Secret access key
            region: region //Region
        });
    
        let s3 = new AWS.S3();
        var getParams = {
            Bucket: bucketName,
            Key: "projects/" + project_uid + "/data/" + filename
        }
        
        let checkFile=await new Promise((resolve,error)=>{
          s3.headObject(getParams, function(err, data) {
            // Handle any error and exit
            if (err)
              resolve(err);
            resolve(data);
          });
        });
  
        // check file
        if(typeof checkFile.ContentType=="undefined"){
          return res.status(400).send({"type": "RXSUCCESS", "data":{"text":"File not found"}});
        }
     
        // store in database
        let data = await ProjectFile.create({
            project_id: project_id,
            user_id : user_id,
            name    : original_filename,
            path    : "projects/" + project_uid + "/data/" + filename,
            extra_settings: extra_settings
        })

        let response = {
            id:data.id,
            project_id: project_id,
            user_id: data.user_id,
            name: data.name,
            extra_settings: data.extra_settings,
            created_at: data.createdAt,
            updated_at: data.updatedAt,
            delete_at: data.deleteAt,
        }    

        if (valdateLimit) {
          let by
          
          await increaseLimit(by=1,{app_id : app_id , organization_id : organization_id , usage_type : usage_type})
        }
        await addToIndexQueue("addProjectFile",response)
        
        // Return success
        return res.status(200).send({
            "type": "RXSUCCESS",
            "message": "File uploaded successfully",
            "data":response
        });
    }

    async getProjectFiles(req, res) {

        let input = req.body;
        let user_id = req.authUser.user_id;
        let orderBy = isset(input.orderBy, "DESC");
        let limit = parseInt(isset(input.limit, 10));
        let offset = 0 + (isset(input.page, 1) - 1) * limit;
        if (offset < 1) {
            offset = 0;
        }

        let result = validateParameters(["project_uid"], input);
    
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

        // check user privilege
        const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['viewer','owner','editor'],key:input.project_uid})
        logInfo("permission",permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let searchFilter={}
        if(typeof input.node!="undefined"){
          searchFilter.node_id=input.node
        }
        if (input.status) {
          searchFilter.status = input.status;          
        }

        let data = await ProjectFile.findAndCountAll({
          where: {
            project_id: project_data.id,
            ...searchFilter
          },
          limit: limit,
          offset: offset,
          order: [['id', orderBy]]
        })

        return res.status(200).send({
          type:"RXSUCCESS",
          message:"Data Fetched Successfully!",
          total: data.count,
          data: data['rows']
        })
    }

    async deleteFile(req, res) {
      let user_id = req.authUser.user_id;
      let input = req.body;
      let result = validateParameters(["id","project_uid"], input);
      let current_date = Date.now();
    
      if (result != 'valid') {
        let error = formatJoiError(result.errors);
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid params",
          errors: error
        });
      }
      let project_uid = input.project_uid;
      let id          = input.id
      // call getProject function to get project_id
      let project_data = await getProject(res,project_uid);
      let project_id = project_data.id;
      const organization_id = project_data?.organization_id
      const app_id = project_data?.app_id
      // check user privilege
      const permission =await userPrivilege({type :'project',searchParam :{user_id:user_id,project_id:project_id},allowedRole:['owner','editor'],key:input.project_uid})
      logInfo("permission",permission);
      if (permission !== 'valid') {
          return res.status(400).send({
              type: "RXERROR",
              message: permission.message,
          })
      }
      let projectFileData = await ProjectFile.findOne({
        where : {
            id : input.id,
            project_id: project_id
        }
      })
      if(!projectFileData){
          return res.status(400).send({ type:"RXERROR",message:"Not found" })
      }

      let projectSetting = await ProjectSetting.findOne({
        where: {
          project_id: project_id
        }
      })
      
      await deleteQdrantDoc(projectSetting, projectFileData.node_id)   
      await ProjectFile.destroy({
        where:{
            id:id,
            project_id:project_id
        }
      });
      await UsageData.decrement('usage_value', { by: 1, where: { organization_id: organization_id,app_id : app_id,usage_type : "document" }});
     
    
      try{
        if(projectFileData.provider=="carbon"){
           const options = {
             method: 'POST',
             headers: { 
              "Content-Type": "application/json",
              authorization: `Bearer ${config('carbon').carbon_auth_token }`, 
              'customer-id': String(project_id) 
            },
             body: JSON.stringify({"file_ids":[projectFileData.provider_file_id] }),
             redirect: "follow"
           };
           let data=await fetch('https://api.carbon.ai/delete_files', options).then(response => response.json())
           logInfo("carbon delete file",data, options)
         }
       }catch(e){
         logInfo("error",e)
       }
      
    
      
   
    
      return res.status(200).send({
        type : "RXSUCCESS",
        message : "Project file deleted successfully"
      })

  }

    async deleteFiles(req, res) {
      let input = req.body;
      let user_id = req.authUser.user_id;
      let result = validateParameters(["ids"], input);
    
      if (result != 'valid') {
        let error = formatJoiError(result.errors);
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid params",
          errors: error
        });
      }

      let idsArr = input.ids.split(',');
      try{
      await ProjectFile.destroy({
        where:{
          id: idsArr
        }
      })
      }catch(err){
        return res.status(400).send({
          type: "RXERROR",
          message: "Oops! some error occured"
        })
      }

      return res.status(200).send({
        type: "RXSUCCESS",
        message: "file removed successfully!"
      })
    }

    async renameFile(req, res) {

      let input = req.body;
     
      let result = validateParameters(["id","name"], input);
    
      if (result != 'valid') {
        let error = formatJoiError(result.errors);
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid params",
          errors: error
        });
      }

      try{
        await ProjectFile.update({
          name:input.name
        }, {
          where:{
            id: input.id
          }
        })
      }catch(err){
        return res.status(400).send({
          type: "RXERROR",
          message: "Oops! some error occured"
        })
      }

      return res.status(200).send({
        type: "RXSUCCESS",
        message: "Data Updated Successfully!"
      })
    }

    async updateChatbotFileExtraSettings(req, res) {
      let input = req.body;
      let user_id = req.authUser.user_id;
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
      const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project_id }, allowedRole: ['owner', 'editor'], key: input.project_uid })
      logInfo("permission", permission);
      if (permission !== 'valid') {
        return res.status(400).send({
            type: "RXERROR",
            message: permission.message,
        })
      }

      try{
        input.ids = input.ids.split(',')
        input.status = "pending";
        await ProjectFile.update(input, {
          where:{
            id: {
              [Op.in]: input.ids
            }
          }
        })
        let data = await ProjectFile.findAll({
          where:{
            id: {
              [Op.in]: input.ids
            }
          }
        })
        for (let i = 0; i < data.length; i++) {
          let element = data[i];
          let response = {
            id:element.id,
            project_id: project_id,
            user_id: element.user_id,
            name: element.name,
            extra_settings: element.extra_settings,
            created_at: element.createdAt,
            updated_at: element.updatedAt,
            delete_at: element.deleteAt,
          }
          await addToIndexQueue("addProjectFile",response)          
        }
  
        return res.status(200).send({
          type: "RXSUCCESS",
          message: "Data Updated Successfully!"
        })
      }catch(err){
        logInfo("error",err);        
        return res.status(400).send({
          type: "RXERROR",
          message: "Oops! some error occured"
        })
      }
    }
};

