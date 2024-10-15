const { User, UserSession, Organization, DiscordConnectedAccount, UserCommunityAndReward, Invitation,Subscriber,ForgetPassword,OrganizationMember,EmailVerification,UserActivityLog,UserPromocode,DataDeletionRequest,Project , ChatbotPartner } = require("../../../../Models");
let sha256 = require("sha256");
let moment = require("moment");
let Joi = require("@hapi/joi");
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer')
let { syncContactToBrevo } = require(baseDir() + "helper/syncContactToBrevo");
let { sendEmailNotification } = require(baseDir() + "helper/email");
let { formatJoiError, isset, count, rand, validateParameters, getIpDetail,loadEmailTemplate,createJwtToken,notifyOnDiscord,generateRandomCode, isStrongPassword } = require(baseDir() + "helper/helper");
// let { sessionMiddleware } = require('../../Middlewares/Auth')
let Sequelize = require("sequelize");
const { Op } = require("sequelize")
const jwt = require('jsonwebtoken')
let AWS = require('aws-sdk');
const mime = require('mime');
const { stripe_secret_key, }=config('stripe')
const stripe = require('stripe')(stripe_secret_key);
const { addToBrevoNewsletter } = require(baseDir() + '/helper/syncContactToBrevo');


module.exports = class UserController {
  async socialLogin(req, res) {

    let input = req.body;
    let result = validateParameters(["firebase_uid"], input);

    if (result != 'valid') {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error
      });
    }

    // Input params
    let firebase_uid = isset(input.firebase_uid, "");
    let username = isset(input.username, "");
    let email = isset(input.email, "");
    let name = isset(input.name, "");
    let type = isset(input.type);
    let first_name = isset(input.first_name);
    let last_name = isset(input.last_name);
    let phone_no = isset(input.phone_no);
    let phone_code = isset(input.phone_code);
    let profile_pic = isset(input.profile_pic);;
    // let country = isset(input.country);
    let source = isset(input.source, "android");
    let version = isset(input.version);
    let device_info = isset(input.device_info);
    let ip_address = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    let hash = isset(input.hash, "");

    let user = {};
    let responseMessage = "";

    let ip_detail = await getIpDetail(ip_address)
    let country;
    if(typeof ip_detail === 'undefined' || ip_detail === null){
      country = null
    } else {
      country = ip_detail.country
    }
    // Get the user count
    let userData = await User.findOne({
      where: { firebase_uid: firebase_uid },
    });
    let newAccount=null
    if (userData == null) {
      if (typeof email != "undefined" && email != null) {
        let users = await User.findAll({ where: { email: email } });
        // If username already exists
        if (count(users) > 0) {
          return res.status(400).send({
            type: "RXERROR",
            message: "Please log in to your account using your email and password"
          });
        }
      }

      // Create username
      username = await this.createUsername(email);
      if (name == "") {
        name = username;
      }

      user = await User.create({
        name: name,
        email: email,
        username: username.replace(/[^0-9A-Za-z\_]+/gm, ""),
        firebase_uid: firebase_uid,
        country: country,
        type: type,
        email_verified: '1',
        first_name :first_name,
        last_name : last_name,
        phone_no :phone_no,
        phone_code : phone_code,
        profile_pic : profile_pic
      });

      await sendEmailNotification("account_created",user.id,{name : user.name})
      const strdata = `New User registered: \`\`\`user_id = ${user.id} , name = ${user.name}, name = ${user.email},country  = ${user.country}\`\`\``
      await notifyOnDiscord(strdata)

      let invitation = await Invitation.findOne({
        where: {
          hash: hash
        }
      });

      if (invitation == null) {
        let organization=await Organization.create({
          created_by: user.id,
          name: "Default",
          openai_key: input.openai_key
        })
        await OrganizationMember.create({
          role: "owner",
          user_id: user.id,
          organization_id:organization.id
        });
      }
      responseMessage = "Account Created Sucessfully";
      newAccount=true;
    } else {

      user = await User.findOne({ where: { firebase_uid: firebase_uid } });
      responseMessage = "Login Sucessfully"
      newAccount=true;
    }

    let user_id = user.id;

    let token = sha256(
      "YOUR_GPT" + user.id + "-" + Math.floor(Date.now() / 1000)
    );

    let data = {
      "id": user.id,
      "name": name,
      "email": email,
      "username": user.username,
      "firebase_uid": firebase_uid,
      "is_blocked": user.is_blocked,
      "type": user.type,
      "country": user.country,
      "created_at": user.createdAt,
      "newAccount":newAccount,
      "session_token":token,
      "first_name":user.first_name,
      "last_name":user.last_name,
      "phone_no":user.phone_no,
      "phone_code":user.phone_code,
      "profile_pic":user.profile_pic
    };

    data.user_id = user_id;
    // expire old session
    try {
      // await UserSession.update(
      //   {
      //     expires_at: Sequelize.literal("now()"),
      //   },
      //   {
      //     where: {
      //       user_id: user_id,
      //     },
      //   }
      // );

      // create new
      await UserSession.create({
        user_id: user_id,
        token: token,
        fcm_token: firebase_uid,
        source: source,
        device_info: device_info,
        ip_address: ip_address,
        country:country,
        version: version,
        expires_at: moment().add(1, "year").format("YYYY-MM-DD HH:mm:ss"),
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      });

      const jwtToken = await createJwtToken(data)

      data.token = jwtToken;
      let contactData = {
        userid:user_id,
        firstname:user.first_name,
        country:user.country,
        email:user.email,
        // firstname:user.first_name,
        lastname:user.last_name,
        phoneno:user.phone_no
      }

      let contact = await syncContactToBrevo(contactData);
      await UserActivityLog.create({
        user_id:user.id,
        action:'last_login',
        info: "Social login by "+user.email
      })
      return res.send({
        "type": "RXSUCCESS",
        "message": responseMessage,
        "data": data
      });
    } catch (e) {
      logInfo("this is catch block", e);
      return res.status(400).send({
        type: "RXERROR",
        message: "sometihing went wrong",
      });
    }


  }

  async register(req, res) {

    let input = req.body;
    let ip_address = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    let result = validateParameters(["name", "password", "email" , "first_name" ,"last_name","phone_no","phone_code"], input);
    if (result != 'valid') {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error
      });
    }
    let email = input.email;
    input.organization="Default"
    const isValidEmail = await this.validateEmail(email);
    if(isValidEmail===false){
      return res.status(400).send({type:"RXERROR",message:"Please add a valid email"})
    }
    let ip_detail = await getIpDetail(ip_address)
    let country;
    if(typeof ip_detail === 'undefined' || ip_detail === null){
      country = null
    } else {
      country = ip_detail.country
    }
    //create username
    let username = await this.createUsername(input.email);

    // check if email already exists

    let emailCheck = await User.findOne({
      where: {
        email: input.email
      }
    });

    if (emailCheck) {
      return res.status(400).send({
        type: "RXERROR",
        message: "Email already exists"
      })
    }
    let maildata = config('mail')
    let partner_data = null
    if (input.partner_uid) {
      partner_data = await ChatbotPartner.findOne({
        where: {
          partner_uid: input.partner_uid
        }
      })
      if (!partner_data) {
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid partner"
        });
      }
      if (partner_data.status == '0') {
        return res.status(400).send({
          type: "RXERROR",
          message: "Partner is not active"
        });
      }
      maildata = partner_data.email_config
    }
    const isPasswordStrong = isStrongPassword(input.password);
    if (!isPasswordStrong) return res.status(400).send({ type: "RXERROR", message: "Password Should be 8 digit & including 1 Symbol and 1 number" });

    //hash password 
    let hashedPass = await bcrypt.hash(input.password, 10);

    // create user
    let user = await User.create({
      name: input.name,
      username: username,
      email: input.email,
      password: hashedPass,
      country:country,
      phone_code : input.phone_code,
      first_name : input.first_name,
      last_name : input.last_name,
      phone_no : input.phone_no,
      partner_id : partner_data?.id
    });
    //create organisation
    let organization=await Organization.create({
      created_by: user.id,
      name: input.organization
    })
    
    await OrganizationMember.create({
      role: "owner",
      user_id: user.id,
      organization_id:organization.id
    });

    let token = sha256(
      "YOUR_GPT" + user.id + "-" + Math.floor(Date.now() / 1000)
    );

    //create session 
    await UserSession.create({
      user_id: user.id,
      token: token,
      source: input.source,
      device_info: input.device_info,
      ip_address: ip_address,
      version: input.version,
      country:country,
      expires_at: moment().add(1, "year").format("YYYY-MM-DD HH:mm:ss"),
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
    });



    const str = "yourGPT"+ input.email + Math.floor(Date.now() / 1000) + Math.floor(Date.now() / 1000);
    const hash = sha256(str);
    const url = `https://app.yourgpt.ai/verify-email/${hash}`;

    const expired_at = moment().add(1, "day").format("YYYY-MM-DD HH:mm:ss");
    // logInfo(maildata);
    let transporter = nodemailer.createTransport(maildata);
    
    // send mail with defined transport object
    let htmlMessage = await loadEmailTemplate("verifyEmail.ejs", {
      logo : partner_data ? partner_data.logo : "https://yourgpt.ai/images/email/yourgpt-logo.png",
      email: input.email,
      url : partner_data ? `https://${partner_data.dashboard_domain}/verify-email/${hash}` : url,
      name: input.name,
      brandName : partner_data && partner_data.name ? partner_data.name : "YourGPT",
      year : new Date().getFullYear()
    });
    try {
    let info = await transporter.sendMail({
      from: partner_data ? partner_data.email_config.email :'"YourGPT Team" <noreply@yourgpt.ai>"', // sender address
      to: input.email, // list of receivers
      subject: "Verify your email address", // Subject line
      html: htmlMessage, // plain text body
    });
    if (info.messageId) {

      await EmailVerification.create({email : input.email , hash : hash , expired_at : expired_at})

      let data = {
        "id": user.id,
        "name": input.name,
        "email": input.email,
        "username": user.username,
        "first_name":input.first_name,
        "last_name":input.last_name,
        "phone_no":input.email,
        "phone_code":input.phone_code,
        "created_at": user.createdAt,
        "newAccount":true,
        "email_verified":  (user.email_verified == 1) ? true : false,
        "session_token":token,
        "partner_id":partner_data?.id
      };

      const jwtToken = await createJwtToken(data)

      data.token = jwtToken;

      return res.status(200).send({
        type: "RXSUCCESS",
        message: "Registered Successfully",
        data: data
      })
    }
  }
    catch (error) {
      logInfo(error);
    }

    return res.status(400).send({
      type: "RXERROR",
      message: "Something went wrong",
      // data: data
    })
    
  }

  async login(req, res) {

    let input = req.body;

    let result = validateParameters(["password", "email"], input);
    let ip_address = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    if (result != 'valid') {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error
      });
    }
    //  ip_address = "223.178.211.1"
    let ip_detail = await getIpDetail(ip_address)
    let country;
    if(typeof ip_detail === 'undefined' || ip_detail === null){
      country = null
    } else {
      country = ip_detail.country
    }

    let user = await User.findOne({
      where: {
        email: input.email
      }
    })

    if (user == null) {
      return res.status(400).send({
        type: "RXERROR",
        message: "No user found!"
      })
    }
    if (user.is_blocked == "1") return res.status(400).send({ type: "RXERROR", message: "Your account has been blocked" });
    if(user.password==null){
      user.password=""
    }
    logInfo(input.password, user.password)
    const validate = await bcrypt.compare(input.password, user.password);

    if (!validate) {
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid Password"
      })
    }
    let partner_data = null
    if (input.partner_uid) {
      partner_data = await ChatbotPartner.findOne({
        where: {
          partner_uid: input.partner_uid
        }
      })
      if (!partner_data) {
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid partner"
        });
      }
      if (partner_data.status == '0') {
        return res.status(400).send({
          type: "RXERROR",
          message: "Partner is not active"
        });
      }
    }

    let token = sha256(
      "YOUR_GPT" + user.id + "-" + Math.floor(Date.now() / 1000)
    );
    let expires_at = moment().add(1, "weeks").format("YYYY-MM-DD HH:mm:ss") ,fcm_token = null
    if (typeof input?.source != undefined && ( input?.source?.toLowerCase() == "android" || input?.source?.toLowerCase() == "ios")) {
      expires_at = moment().add(3, "months").format("YYYY-MM-DD HH:mm:ss");
      fcm_token = input.fcm_token
    }

    //create session 
    await UserSession.create({
      user_id: user.id,
      token: token,
      source: input.source,
      device_info: input.device_info,
      ip_address: ip_address,
      country:country,
      version: input.version,
      expires_at: expires_at,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
      fcm_token: fcm_token
    });


    let data = {
      "id": user.id,
      "name": input.name,
      "email": input.email,
      "username": user.username,
      "created_at": user.createdAt,
      "newAccount": false,
      "email_verified":  (user.email_verified == 1) ? true : false,
      "session_token":token,
      "partner_id" : partner_data?.id    
    };
   
    const jwtToken = await createJwtToken(data)

    data.token = jwtToken;

    await UserActivityLog.create({
      user_id:user.id,
      action:'last_loggedin',
      info:user.username+" / "+user.email
    })

    return res.status(200).send({
      type: "RXSUCCESS",
      message: "Logged in successfully!",
      data: data
    })
  }

  async updateProfile(req, res) {

    // request input
    let validationInput = req.body;

    let name = validationInput.name;
    let username = validationInput.username;
    let first_name = validationInput.first_name;
    let last_name = validationInput.last_name;
    let profile_pic = validationInput.profile_pic;

    // convert into JSON
    let input = JSON.parse(JSON.stringify({ username: username, name: name, first_name: first_name,last_name:last_name, profile_pic: profile_pic }));

    // vaildate
    let result = updateProfileValidation.validate(input, { abortEarly: false });

    //if any error
    if (result.error) {
      let error = formatJoiError(result.error);
      return res.status(400).send({
        type: "RXERROR",
        message: error[Object.keys(error)[0]],
        error: error,
        input: input
      });
    }
    let user_id = req.authUser.User.id;
    // Check username if already taken
    if (typeof input.username != "undefined") {

      if ((input.username).length < 4) {
        return res.status(400).send({ type: "RXERROR", message: "Username must be at least 4 characters" });
      }

      let user = await User.findOne({ attributes: ["username"], where: { username: input.username, id: { [Sequelize.Op.not]: user_id } } });
      if (user != null) {
        return res.status(400).send({ type: "RXERROR", message: "username is not available." });
      }
    }
    if(typeof input.profile_pic!="undefined" && input.profile_pic!=""){
      input.profile_pic="https://content.yourgpt.ai/profile/"+input.profile_pic;
    }

    // Update user
    await User.update(input, {
      where: { id: user_id }
    });
    let data = await User.findOne({
      where: { id: user_id }
    });
    await UserActivityLog.create({
      user_id:user_id,
      action:'profile_updated',
      info:name+" / "+username
    })


    return res.status(200).send({ type: "RXSUCCESS", message: "User detail updated successfully",data : data });
  }

  async getDetail(req, res) {

    // get user_id from token
    let user = req.authUser.User;

    // set custom response
    let data = {
      "id": user.id,
      "name": user.name,
      "email": user.email,
      "last_name": user.last_name,
      "first_name": user.first_name,
      "username": user.username,
      "phone_no": user.phone_no,
      "firebase_uid": user.firebase_uid,
      "type": user.type,
      "country": user.country,
      "profile_pic": user.profile_pic,
      "created_at": user.createdAt,
      "partner_id":user.partner_id,
    };

    // return 200

    await UserActivityLog.create({
      user_id:user.id,
      action:'get_detail',
      info:data.username+" / "+data.email
    })
    return res.status(200).send({
      type: "RXSUCCESS",
      message: "Data Fetched Successfully!",
      data: data
    });
  }
  async checkAlreadyExists(input, res) {
    let users = await User.findAll({ where: input });
    // If username already exists
    if (count(users) > 0) {
      return res.status(400).send({
        type: "RXERROR",
        message: Object.keys(input)[0] + " already exists",
        error: {
          [Object.keys(input)[0]]: Object.keys(input)[0] + " already exists",
        },
      });
    }
  }

  async createUsername(email) {
    let username;
    let uniqueUsername = false;

    // Iterate
    do {
      if (email == null) {
        username = "openai-saas" + rand(1111, 9999) + rand(1111, 9999);
      } else {
        username = email.split("@")[0] + "" + rand(111, 999);
      }

      // Check the assigned username is unique
      if (count(await User.findAll({ where: { username: username } })) < 1) {
        uniqueUsername = true;
      }
    } while (!uniqueUsername);

    return username;
  }

  async subscribeMe(req,res){
    try {
        let input = req.body;
        if(typeof input.email=="undefined"){
          return res.status(400).json({ type:"RXERROR",message: "Email is required" });
        }
        let resultData=await Subscriber.create({email:input.email});
        return res.status(200).send({ type:"RXSUCCESS",message:'Subscription successful',resultData});
      } catch (error) {
        return res.status(400).json({ type:"RXERROR",message: error.message });
      }
  }
  
  async sendResetEmail(req, res) {
    let input = req.body;
    
    // validate params
    let result = validateParameters(["email"], input);

    if (result != "valid") {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error,
      });
    }

    // for url hash
    const str = "yourGPT"+ input.email + Math.floor(Date.now() / 1000) + Math.floor(Date.now() / 1000);
    const hash = sha256(str);
    const url = `https://app.yourgpt.ai/reset-password/${hash}`;

    const expired_at = moment().add(1, "day").format("YYYY-MM-DD HH:mm:ss");
    let maildata = config('mail')
    let partner_data = null
    if (input.partner_uid) {
      partner_data = await ChatbotPartner.findOne({
        where: {
          partner_uid: input.partner_uid
        }
      })
      if (!partner_data) {
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid partner"
        });
      }
      if (partner_data.status == '0') {
        return res.status(400).send({
          type: "RXERROR",
          message: "Partner is not active"
        });
      }
      maildata = partner_data.email_config
    }

    // finding user by mail exists or not
    let user = await User.findOne({
      where: {
        email: input.email
      },
    });

    // if user send mail
    if (user) {
      // create reusable transporter object using the default SMTP transport
      let transporter = nodemailer.createTransport(maildata);

      // send mail with defined transport object
      let htmlMessage = await loadEmailTemplate("resetPassword.ejs", {
        email: input.email,
        url: partner_data ? `https://${partner_data.dashboard_domain}/reset-password/${hash}` : `https://app.yourgpt.ai/reset-password/${hash}`,
        name : user.name ,
        logo : partner_data ? partner_data.logo : "https://yourgpt.ai/images/email/yourgpt-logo.png",
        domain : partner_data ? `https://${partner_data.dashboard_domain}/` : "https://yourgpt.ai/",
        brandName : partner_data && partner_data.name ? partner_data.name : "YourGPT",
        year : new Date().getFullYear()
      });
      try {
        let info = await transporter.sendMail({
          from: partner_data ? partner_data.email_config.email : "noreply@yourgpt.ai", // sender address
          to: user.email, // list of receivers
          subject: "Your reset password request", // Subject line
          html: htmlMessage, // plain text body
        });

        if (info.messageId) {
          const data = await ForgetPassword.create({
            user_id:user.id,
            email: input.email,
            hash:hash,
            expired_at:expired_at,
          });
          return res.status(200).json({
            type: "RXSUCCESS",
            message: `Check your email for a link to reset your password. If it doesn’t appear within a few minutes, check your spam folder.`
          });
        }
        return res
          .status(400)
          .send({ type: "RXERROR", message: "Something went wrong" });
      } catch (error) {
        logInfo(error);
      }
    }
    if (!user) {
      return res
        .status(400)
        .send({ type: "RXERROR", message: "user doesn't exists" });
    }
  }

  async resetPassword(req, res) {
    let input = req.body;

    let result = validateParameters(["hash","password"], input);

    if (result != "valid") {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error,
      });
    }

    const data = await ForgetPassword.findOne({
      where: {
        hash: input.hash,
        expired_at: { [Op.gte]: Sequelize.literal("NOW()") },
      },
    });

    if (data) {
      const isPasswordStrong = isStrongPassword(input.password);
      if (!isPasswordStrong) return res.status(400).send({ type: "RXERROR", message: "Password Should be 8 digit & including 1 Symbol and 1 number" });
      let hashedPass = await bcrypt.hash(input.password, 10);
      const user = await User.update(
        { password: hashedPass },
        { where: { id: data.user_id } }
      );
      await ForgetPassword.destroy({ where: { id: data.id } });
      return res.status(200).send({
        type: "RXSUCCESS",
        message: "Password change successfully",
      });
    }else {
      return res.status(200).send({
        type: "RXERROR",
        message: "No user found",
      });
    }
  }
  
  async changePassword(req,res) {
    const input = req.body
    let user_id = req.authUser.User.id;

    // validate the params
    let result = validateParameters(["current_password", "new_password"], input);

      if (result != "valid") {
        let error = formatJoiError(result.errors);
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid params",
          errors: error,
        });
      }
      let currrent_password = req.authUser.User.password;
      // comapre the input password and database password
      const value = await bcrypt.compare(input.current_password,currrent_password)

      // error if wrong currentPassword input 
      if (!value) {
        return res.status(200).send({
          type: "RXSUCCESS",
          message: "The previous password you entered is invalid."
        });
      }
    const isPasswordStrong = isStrongPassword(input.new_password);
    if (!isPasswordStrong) return res.status(400).send({ type: "RXERROR", message: "Password Should be 8 digit & including 1 Symbol and 1 number" });

    // generate new hash for new password
    const Salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(input.new_password,Salt)

    // update the new password
    const data = await User.update({password : hashPassword},{where : {id : user_id}})
    res.send({
        type: "RXSUCCESS",
        message: "Your password has been updated successfully."
    })
  }

  async verifyEmail(req,res) {
    const input = req.body;
    let result = validateParameters(["hash"], input);

      if (result != "valid") {
        let error = formatJoiError(result.errors);
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid params",
          errors: error,
        });
      }

      const emaildata = await EmailVerification.findOne({
        where: {
          hash: input.hash,
          expired_at: { [Op.gte]: Sequelize.literal("NOW()") },
        },
      });

      if (!emaildata) {
        return res.status(400).send({
          type: "RXERROR",
            message: "Invalid url"
        })
      }

      const data = await User.update({email_verified : "1"},{
        where : {email : emaildata.email}
      })
      // let user_data
      
      if (!data) {
        return res.status(400).send({
          type: "RXERROR",
            message: "User not found"
        })
      }
      // dd(emaildata.email,"@@@@@")
      let user_data = await User.findOne({
        where:{
          email : emaildata.email
        }
      })
     
      let contactData = {
        userid:user_data.id,
        firstname:user_data.first_name,
        country:user_data.country,
        email:user_data.email,
        lastname:user_data.last_name,
        phoneno:user_data.phone_no
      }

      const strdata = `New User registered: \`\`\`user_id = ${user_data.id} , name = ${user_data.name}, name = ${user_data.email},country  = ${user_data.country}\`\`\``
      !user_data.partner_id && await notifyOnDiscord(strdata)
      !user_data.partner_id && await sendEmailNotification("account_created",user_data.id,{name : user_data.name})

      !user_data.partner_id && await syncContactToBrevo(contactData);

      return res.status(200).send({
        type: "RXSUCCESS",
          message: "Email verified successfully"
      })
  }

  async resendEmailVerification(req,res){
    let input = req.body;
    let email = input.email;
    // validate the params
    let result = validateParameters(["email"], input);

    if (result != 'valid') {
        let error = formatJoiError(result.errors);
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid params",
          errors: error
        });
    }
    let current_date = Date.now();
    
    let user = await User.findOne({
      where:{
        email:email,
        // email_verified:'0'
      }
    })
    if(!user){
      return res.status(400).send({type:"RXERROR",message:"Invalid user"})
    }
    let maildata = config('mail')
    let partner_data = null
    if (input.partner_uid) {
      partner_data = await ChatbotPartner.findOne({
        where: {
          partner_uid: input.partner_uid
        }
      })
      if (!partner_data) {
        return res.status(400).send({
          type: "RXERROR",
          message: "Invalid partner"
        });
      }
      if (partner_data.status == '0') {
        return res.status(400).send({
          type: "RXERROR",
          message: "Partner is not active"
        });
      }
      maildata = partner_data.email_config
    }

    let email_verification_data = await EmailVerification.findOne({
      where:{
        email:email     
      }
    })
    if(!email_verification_data){
      const str = "yourGPT"+ input.email + Math.floor(Date.now() / 1000) + Math.floor(Date.now() / 1000);
      const hash = sha256(str);
      const expired_at = moment().add(1, "day").format("YYYY-MM-DD HH:mm:ss");
      email_verification_data=await EmailVerification.create({email : input.email , hash : hash , expired_at : expired_at})
    }
    
    // logInfo(maildata);
    let transporter = nodemailer.createTransport(maildata);
    // const hash = sha256(str);
    const hash = email_verification_data.hash
    // dd(hash,"*************")
    const url = `https://app.yourgpt.ai/verify-email/${hash}`;
    
    // send mail with defined transport object
    let htmlMessage = await loadEmailTemplate("verifyEmail.ejs", {
      logo : partner_data ? partner_data.logo : "https://yourgpt.ai/images/email/yourgpt-logo.png",
      email: email,
      url : partner_data ? `https://${partner_data.dashboard_domain.replace(/^(https?:\/\/)/, '')}/erify-email/${hash}` : url,
      name: user.name,
      brandName : partner_data && partner_data.name ? partner_data.name : "YourGPT",
      year : new Date().getFullYear()
    });

    let info = await transporter.sendMail({
      from: partner_data ? partner_data.email_config.email : '"YourGPT Team" <noreply@yourgpt.ai>"', // sender address
      to: email, // list of receivers
      subject: "Verify your email address", // Subject line

      html: htmlMessage, // plain text body
    });

    if (info.messageId) {
      await EmailVerification.update({ expired_at: Sequelize.literal(`expired_at + interval 3600 SECOND`)},{
        where:{
          id:email_verification_data.id     
        }
      })
      return res.status(200).send({type:"RXSUCCESS",message:"Email resend successfully"})
    }
    return res.status(400).send({type:"RXERROR",message:"Something went wrong"})
    
  }

  async validateEmail(email) {
    // Regular expression pattern for email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }


  async sendEmailSubscriptionPromocode(req, res) {
      const input = req.body
      
      // validate the params
      let result = validateParameters(["email"], input);

      if (result != 'valid') {
          let error = formatJoiError(result.errors);
          return res.status(400).send({
            type: "RXERROR",
            message: "Invalid params",
            errors: error
          });
      }

      const sent = await UserPromocode.findOne({
          where : {
              email : input.email
          }
      })

  
      try {
        let code = generateRandomCode();
        if (!sent) {
          const Timestamp = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
          const promotionCode = await stripe.promotionCodes.create({
            coupon: 'GET12MONTHDEAL',
            code: code,
            expires_at: Timestamp
          });
          await UserPromocode.create({
              email: input.email,
              promocode: promotionCode.code,
              expires_at: moment().add(1,'days').format("YYYY-MM-DD HH:mm:ss")
          })
        }else{
          code=sent.promocode;
        }

          await sendEmailNotification('user_promocode',input.email,{title:"🔥 Limited Time Only! Unlock 30% Savings with Our Exclusive Promo Code 💰", promocode : code})
          return res.status(200).send({
              type : "RXSUCCESS",
              message : "Email send Successfully"
          })
      } catch (error) {
          logInfo(error);
          return res.status(400).send({
              type: "RXERROR",
              message: "Something went wrong"
          });
      }
  }

  async getIpDetail(req,res){
    let ip_address = "223.178.211.161";
    let data= await getIpDetail(ip_address);
    return res.send(data);
  }

  
    /**
     * Get signed url
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
    async getProfileSignedUrl(req, res) {
      // Input & validate
      let input = req.body;
      // validate input parameters
      let result = validateParameters(["file_name"], input);
      if (result != 'valid') {
          let error = formatJoiError(result.errors);
          return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
          });
      }
      let fileName = input.file_name;
      fileName = fileName.replace(/ /g, "-");

      AWS.config.update({
          accessKeyId: config("aws").accessKeyId, // Access key ID
          secretAccessKey: config("aws").secretAccessKey, // Secret access key
          region: 'eu-north-1' //Region
      });

      let fileSplit=fileName.split(".")
      // Singed URL
      let filename = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100) +"."+ fileSplit[fileSplit.length -1]
      let modifiedFileName = "profile/" + filename;
      let s3 = new AWS.S3({
          // signatureVersion: 'v4'
      });
      const mime_type = mime.getType(modifiedFileName)
      // Singed
      let signedUrl = s3.getSignedUrl('putObject', {
          Bucket: "content.yourgpt.ai",
          Key: modifiedFileName,
          ContentType : mime_type,
          ACL     : 'public-read'
      });
      // logInfo('presigned url: ', signedUrl);

      // Return success
      return res.status(200).send({ "type": "RXSUCCESS", "data": { "url": signedUrl, "filename": filename, "mime_type":mime_type,"path":modifiedFileName } });
  }

  /**
     * Create a request for user data deletion so admin can delete user data
     * @param {*} req 
     * @param {*} res 
     * @returns 
     */
  async createDataDeletionRequest(req, res) {

    let input = req.body;
    let user_id = req.authUser.user_id
    let result = validateParameters(["reason"], input);

    if (result != 'valid') {
        let error = formatJoiError(result.errors);
        return res.status(400).send({
            type: "RXERROR",
            message: "Invalid params",
            errors: error
        });
    }

    let requestData = await DataDeletionRequest.findOne({
        where : {
            user_id : user_id
        }
    })
    if (requestData) {
      let str = "If you require any assistance, please don't hesitate to contact us at support@yourgpt.ai."
        return res.status(400).send({
            type: "RXERROR",
            message: requestData.status == "deleted" ? `Data already deleted. ${str}` :`Your request is already under review. ${str}`
        });
    }

    let projectData = await Project.findAll({
      where: {
        created_by: user_id
      }
    });
    
    if (projectData.length > 0) {
        return res.status(400).send({
            type: "RXERROR",
            message: `Please delete all of your projects first and try again`
        });
    }
    try {
        let data = await DataDeletionRequest.create({
            user_id : user_id,
            reason : input.reason
        })
        const str = `User Data Deletion Request Created \`\`\`user_id =${user_id} , name=${req.authUser.User.name}, email = ${req.authUser.User.email}, reason = ${input.reason}, created_at = ${data.createdAt}\`\`\``
        await notifyOnDiscord(str)
        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Request created successfully",
            data : data
        });
    } catch (error) {
        logInfo(error);
        return res.status(400).send({
            type: "RXERROR",
            message: "Something went wrong"
        });
    }
}
 
 async logout(req,res){
  let user_id = req.authUser.user_id
  let token = req.authUser.token
  await UserSession.destroy({
    where : {
      user_id : user_id,
      token : token
    }
  })
  return res.status(200).send({
    type : "RXSUCCESS",
    message : "Logout successfully"
  })
 }

 async generateSSOToken(req,res){
  let { username, email, first_name, last_name, profile_pic} = req.authUser.User;
  let jwt_token = jwt.sign({ username,email,first_name, last_name, name:(first_name+last_name), profile_pic }, config('app').epicxplorer_sso_key, { expiresIn: '1h' });
  return res.status(200).send({
    type : "RXSUCCESS",
    message : "SSO token generated successfully",
    data: {
      token: jwt_token
    }
  })
 }

 /**
  * update the user session fcm token
  * @param {*} req
  * @param {*} res
  * @returns
  */
  async updateFcmToken(req, res) {
    let input = req.body;
    let user_id = req.authUser.User.id;
    let result = validateParameters(["fcm_token"], input);
    if (result != 'valid') {
      let error = formatJoiError(result.errors);
      return res.status(400).send({
        type: "RXERROR",
        message: "Invalid params",
        errors: error
      });
    }
    let data = await UserSession.update({ fcm_token: input.fcm_token }, {
      where: {
        user_id: user_id,
        id: req.authUser.id
      }
    });
    return res.status(200).send({
      type: "RXSUCCESS",
      message: "Fcm token updated successfully"
    });
  };


  async getUserCommunityAndReward(req, res) {

    // get user_id from token
    let user = req.authUser.User;

    let data = await UserCommunityAndReward.findOne({ where: { user_id: user.id } });
    if(!data) return res.status(400).send({ type: "RXSUCCESS", message: "Reward data not found"});
    
    return res.status(200).send({
      type: "RXSUCCESS",
      message: "Reward data Fetched Successfully!",
      data: data
    });
  }

  async discordConnectedAccountRedirectUrl(req, res) {
    try {
      let { state, code } = req.query;
      
      // Validate user ID
      if (!state) return res.redirect("https://app.yourgpt.ai/profile?status=error&message=Invalid%20token");

      let jwtData = await jwt.verify(state, config('jwt').jwt_key);
      let user_id = jwtData.data.id;
  
      // Fetch user data from database
      let user = await User.findOne({ where: { id: user_id } });
      if (!user) return res.redirect("https://app.yourgpt.ai/profile?status=error&message=Invalid%20user");
  
      // Check if Discord account is already connected
      let connected_account = await DiscordConnectedAccount.findOne({ where: { user_id: user_id } });
      if (connected_account) return res.redirect("https://app.yourgpt.ai/profile?status=error&message=Account%20already%20connected%20to%20a%20Discord%20account");
  
      // Discord OAuth2 configuration
      let { discord_auth_id, discord_auth_secret, discord_oauth2_url } = config('discord');
      
      // Exchange authorization code for access token
      let tokenResponse = await fetch(discord_oauth2_url, {
        method: "POST",
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: discord_auth_id,
          client_secret: discord_auth_secret,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: 'https://api.yourgpt.ai/api/v1/discord/connected-account/redirect',
          scope: 'identify email'
        })
      });
      
      let tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return res.redirect("https://app.yourgpt.ai/profile?status=error&message=Invalid%20authorization"); 

      // Fetch Discord user information
      let discordResponse = await fetch('https://discord.com/api/v9/users/@me', {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      let discordUser = await discordResponse.json();
      logInfo("Discor User Data =>", discordUser);

      let discord_account = await DiscordConnectedAccount.findOne({ where: { discord_user_id: discordUser.id } });
      if(discord_account) return res.redirect("https://app.yourgpt.ai/profile?status=error&message=Discord%20account%20already%20connected%20to%20another%20account");
  
      // Save Discord account details in the database
      let data = await DiscordConnectedAccount.create({
        user_id: user_id,
        discord_user_id: discordUser.id,
        discord_username: discordUser.username,
        discord_email: discordUser.email,
        discord_global_name: discordUser.global_name || discordUser.username // Fallback to username if global_name is unavailable
      });
      logInfo("Discord Account Data =>", data);
  
      return res.redirect("https://app.yourgpt.ai/profile?status=success&message=Discord%20account%20connected%20successfully");
  
    } catch (error) {
      console.error("ERROR:", error.message);
      return res.redirect("https://app.yourgpt.ai/profile?status=error&message=Something%20went%20wrong");
    }
  };

  async removeConnectedDiscordAccount(req, res) {
    try{
      let user_id = req.authUser.User.id;
      let connected_account = await DiscordConnectedAccount.findOne({ where: { user_id: user_id } });
      if(!connected_account) return res.status(400).json({ type: "RXERROR", message: "No connected Discord account found" });
      await DiscordConnectedAccount.destroy({ where: { id: connected_account.id } });
      return res.status(200).json({ type: "RXSUCCESS", message: "Discord account disconnected successfully" });
    } catch(error){
      logInfo("ERROR",error.message)
      return res.status(400).send({
        type: "RXERROR",
        message: "Something went wrong"
      });
    }
  };

  async getConnectedDiscordAccount(req, res) {
    try{
      let user_id = req.authUser.User.id;
      let data = await DiscordConnectedAccount.findOne({ where: { user_id: user_id } });
      if(!data) return res.status(400).json({ type: "RXERROR", message: "No connected Discord account found" });
      return res.status(200).json({ type: "RXSUCCESS", message: "Discord account fetch successfully", data: data });
    } catch(error){
      logInfo("ERROR",error.message)
      return res.status(400).send({
        type: "RXERROR",
        message: "Something went wrong"
      });
    }
  };
  
};


const updateProfileValidation = Joi.object().keys({
  first_name: Joi.string().max(100, "utf8"),
  last_name: Joi.string().max(100, "utf8"),
  profile_pic: Joi.string(),
  name: Joi.string().max(100, "utf8"),
  username: Joi.string()
    .regex(/^[a-zA-Z0-9_.]*$/)
    .min(5, "utf8")
    .max(100, "utf8")
    .messages({
      "object.regex": "Username should be alpha numberic",
      "string.pattern.base": "Username should be alpha numberic",
    }),
});