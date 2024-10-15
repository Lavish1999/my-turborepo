let { Op } = require("sequelize");
let { User, UserSession, OrganizationMember, CustomWidgetDomain, ChatbotHelpdeskCategory, Organization, ProjectMember, Project, IpAddress,ProjectUsage,sequelize,UsageLimit,UsageData,UserActivityLog,Subscription, SessionMessageFallbackAILog, ProjectKey, ChatbotIntegrationsSetting, ProjectDomain, Session, SessionMessage, ChatbotAccessControlList } = require("../app/Models");
let Sequelize = require("sequelize");
const QueryTypes = Sequelize.QueryTypes;
let moment = require("moment");
let fetch = require("node-fetch");
let Joi = require("@hapi/joi");
const ejs = require('ejs');
const { exist } = require("@hapi/joi");
const crypto = require("crypto");
const algorithm = "aes-256-cbc";
const crypto_data = config('crypto')
let AES_ENCRYPTION_KEY = crypto_data.enc_key
let AES_ENCRYPTION_IV = crypto_data.iv
const jwt = require('jsonwebtoken')
let count_data = config('plan');
let AWS = require('aws-sdk');
const { parsePhoneNumber } = require('awesome-phonenumber');

// const moment = require('moment-timezone');
let Handlebars = require("handlebars");
// Format joi validator error
const formatJoiError = (errors) => {
  let joiErrors = errors.details;
  let formatError = {};
  joiErrors.forEach((data) => {
    formatError[data.path[0]] = data.message.replace(/"/g, "");
  });
  logInfo("log", formatError);
  // logInfo(formatError + "This is for matted error");
  return formatError;
};

const ucfirst = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const rand = (max, min) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const array_rand = (items) => {
  return items[Math.floor(Math.random() * items.length)];
};

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

const isset = (string, value = "") => {
  return typeof string != "undefined" ? string : value;
};

const strpos = (string, value = "") => {
  return string.indexOf(value) != -1 ? string.indexOf(value) : false;
};

const substr = (string, start, end) => {
  return string.substr(start, end);
};

const strlen = (string) => {
  return string != null ? string.length : 0;
};

const in_array = (array, value) => {
  return array.indexOf(value);
};

const count = (array) => {
  return array.length;
};

// getAuthUser details using token
const authUser = async (req) => {
  //logInfo(req,typeof req.token != "undefined");

  // let token
  let token;
  if (typeof req == "string") {
    token = req;
  } else if (typeof req == "object" && typeof req.token != "undefined") {
    token = req.token;
  } else {
    // If authorisation is undefined return null
    if (
      typeof req.headers.authorization == "undefined" ||
      req.headers.authorization == ""
    ) {
      return null;
    }
    // set token headers authorizations
    token = req.headers.authorization;
  }
  // replace if token is coming with bearer
  token = token.replace("Bearer ", "");

  const {jwt_key} = config('jwt')
  try {
    decoder = await jwt.verify(token,jwt_key)
    logInfo(decoder);
    if (!decoder.data.session_token) {
      logInfo("!decoder.session_uid");
      return null
    }
  } catch (error) {
    logInfo("error");
    return null
  }

  // search for attributes
  let user = await UserSession.findOne({
    where: {
      token: decoder.data.session_token,
      expires_at: {
        [Op.gte]: Sequelize.literal("NOW()"),
      },
    },
    include: [
      {
        model: User,
      },
    ],
    order : [['id',"desc"]]
  });
  // return user
  return user;
};

// api Auth
async function apiAuth(req) {
  let api_key;
  if (typeof req == "string") {
      api_key = req;
  } else if (typeof req == "object" && typeof req["api-key"] != "undefined") {
      api_key = req["api-key"];
  } else {
      // If authorisation is undefined return null
      if (
          typeof req.headers["api-key"] == "undefined" ||
          req.headers["api-key"] == ""
      ) {
          return null;
      } else {
          api_key = req.headers["api-key"]
      }
      // set api_key headers authorizations
      api_key = req.headers["api-key"];
  }

  let data = await ProjectKey.findOne({
      include: [{
          model: Project,
          as: 'project'
      }],
      where: {
          api_key: api_key
      },
  });
  return data
}
// domain auth
async function domainAuth(req) {
  let domain, widget_uid;
  if (typeof req.headers.origin != "undefined" && req.headers.origin != "" && typeof req.body.widget_uid != "undefined" && req.body.widget_uid != "") {
      domain = req.headers.origin;
      // Regular expression to capture the main domain and TLD
      const regex = /^(https?:\/\/)?(www\.)?/;

      // Extract the main domain and TLD
      domain = domain.replace(regex, '')
      widget_uid = req.body.widget_uid;
  } else {
    return null;
  }
  let data = await ChatbotIntegrationsSetting.findOne({
      include: [{
        model: Project,
        as: 'project_data'
    }],
      where: {
        widget_uid: widget_uid
      },
  });
  if (data == null) {
    return null;
  }
  let ProjectDomainData = await ProjectDomain.findAll({
    where: {
      project_id: data.project_id
    }
  });
  if (ProjectDomainData.length > 0 && !ProjectDomainData.some(item => item.domain == domain)) {
    return null;
  }
  return data
}

const createJwtToken = async (data) => {
  const { jwt_key } = config('jwt')

  const jwtToken = jwt.sign({data : data},jwt_key)

  return jwtToken
}

const loadEmailTemplate = async (path, data) => {
  return await new Promise((resolve, reject) => {
    ejs.renderFile(baseDir() + "resources/views/mails/" + path, data, function (err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

const validateGoogleRecaptchaToken = async (token) => {
  const secret_key = config("app").google_recaptcha_secret_key;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secret_key}&response=${token}`;

  let captcha = await new Promise(async (resolve, reject) => {
    fetch(url, {
      method: "post",
    })
      .then((response) => response.json())
      .then((google_response) => resolve(google_response))
      .catch((error) => reject(error));
  });

  if (typeof captcha.success != "undefined" && captcha.success) {
    return true;
  } else {
    return false;
  }
};

/**
 * Generates a Joi validator using the array provided and also allows extra params but makes the specified parameters compulsory
 *
 * @param {array} requiredParams array of strings specifiying the required parameters for validator, creates automatic messages using the name as well
 * @returns returns Joi validator object
 */
const generateValidator = (requiredParams) => {
  let obj = {};

  requiredParams.forEach((element) => {
    obj[element] = Joi.any()
      .required()
      .messages({
        "any.required": `${element} cannot be blank`,
        "string.empty": `${element} cannot be blank`,
        "any.validate": `${element} must be String or Number`
      }).custom((value, helpers) => {
        if (typeof value === 'string' && value.trim() === '') {
          return helpers.error('string.empty');
        } else if(value === null || value === undefined){
          return helpers.error('any.required');
        } else if (typeof value === 'object') {
          return helpers.error('any.validate');
        }
        return value;
      });
  });

  return Joi.object().keys(obj).unknown();
};

/**
 *
 * @param {array} requiredParams array of strings specifyinh the required parametrs for validator, creates automatic messages using the name as well
 * @param {req.body} input the input data to validate
 * @returns {string} valid when the parameters are valid
 * @returns {Object} errors when there are errors present, can be directly returned to res.send
 *
 */
const validateParameters = (requiredParams, input) => {
  let validator = generateValidator(requiredParams);

  let result = validator.validate(input, { abortEarly: false });

  // In case of missing parameters, thro
  if (result.error) {
    let error = result.error;
    return {
      message: "Invalid params",
      errors: error,
    };
  }

  return "valid";
};


/**
 * Update coin functionality
 *
 * @param {*} userId
 * @param {*} coins
 * @param {*} action
 * @param {*} updateType
 */
const updateCoinsAndLedger = async (
  userId,
  coins,
  action,
  description = "",
  updateType = "add"
) => {
  let userCreditData = await UserCredit.findOne({
    where: {
      user_id: userId,
    },
  });

  if (updateType != "add" && userCreditData.coins < coins) {
    return { type: "RXERROR", message: "You don't have enough coins" };
  }

  await Ledger.create({
    user_id: userId,
    old: userCreditData.coins,
    new:
      updateType == "add"
        ? parseInt(userCreditData.coins) + parseInt(coins)
        : parseInt(userCreditData.coins) - parseInt(coins),
    type: "coins",
    action: action,
    amount: (updateType == "add" ? "" : "-") + coins,
    description: description,
  });

  await UserCredit.update(
    {
      coins:
        updateType == "add"
          ? Sequelize.literal("coins + " + coins)
          : Sequelize.literal("coins - " + coins),
    },
    { where: { user_id: userId } }
  );

  return { type: "RXSUCCESS", message: "success" };
};

/**
 * 
 * @param {*} type 
 * @param {*} searchParam
 * @param {*} allowedRole
 * @param {*} key
 * @returns user valid or not
 */
const userPrivilege = async ({ type, searchParam, allowedRole = ["owner"], key }) => {

  if (type == "organization") {
    const data = await OrganizationMember.findAll({
      include: [
        {
          model: Organization,
          attributes: ["openai_key"],
          as: 'Organization'
        }
      ],
      where: searchParam
    })
    // logInfo(data);

    if (data.length == 0) {
      return { type: "RXERROR", message: "You are not a member of this organization." }
    }

    const result = allowedRole.find((allowedRole) => {
      return allowedRole == data[0].role

    })

    if (!result) {
      return { type: "RXERROR", message: "Insufficient rights or privileges" }
    } else {
      return 'valid'
    }
  }
  if (type == "project") {

    // Getting project member data through searchParams 
    const data = await ProjectMember.findAll({
      include: [
        {
          model: Project,
          attributes: ["project_uid"],
          as: 'Project'
        }
      ],
      where: searchParam
    })
    // dd(data[0],"++++++++")

    // if not a member of that project_uid
    if (data.length == 0) {
      return { type: "RXERROR", message: "You are not a member of this Project." }
    }

    // validate the project_id  is related to that project_member's Project_key or not which you want to update
    const data1 = data.filter((data) => { return data.Project.project_uid == key })
    //  logInfo("dhasgdhs",data1);

    // error if key is not match
    if (data1.length == 0) {
      return { type: "RXERROR", message: "Incorrect project key" }
    }

    // checking user have sufficient rights or not
    const result = allowedRole.find((allowedRole) => {
      return allowedRole == data1[0].role

    })
    logInfo(result);

    // through error if user have not sufficient rights
    if (!result) {
      return { type: "RXERROR", message: "Insufficient rights or privileges" }
    } else {
      return "valid"
    }
  }
  // if time not match to organization and project
  return { type: "RXERROR", message: "Incorrect type" }
}

const getIpDetail = async (ip) => {
  try {
    let ipData = await IpAddress.findOne({
      where: {
        ip: ip,
        updated_at: {
          [Op.gte]: Sequelize.literal("NOW() - INTERVAL 2 DAY"),
        },
      },
    });
    let appConfigs = config("app");
    if (ipData) {
      return ipData.dataValues;
    } else {
      try {
        ipDetail = await fetch(
          "https://pro.ip-api.com/json/" + ip + "?key=" + appConfigs.ip_token1).then((res) => res.json());

        let ipDataRes = await IpAddress.findOne({ where: { ip: ip } });

        ipData = {
          ip: ipDetail.query,
          city: ipDetail.city,
          region: ipDetail.regionName,
          country: ipDetail.countryCode,
          loc: [ipDetail.lat,ipDetail.lon].toString(),
          org: ipDetail.as,
          postal: ipDetail.zip,
          timezone: ipDetail.timezone,
        };
        if (ipDataRes) {
          await IpAddress.update(ipData, { where: { ip: ip } });
          return ipData;
        } else {
          await IpAddress.create(ipData);
          return ipData;
        }

      } catch (err) {
        return
      }
    }
  } catch (err) {
    try {
      let ipData = await IpAddress.findOne({
        where: {
          ip: ip,
          updated_at: {
            [Op.gte]: Sequelize.literal("NOW() - INTERVAL 2 DAY"),
          },
        },
      });
      let appConfigs = config("app");
      if (ipData) {
        return ipData.dataValues;
      } else {
        // ipDetail = await fetch("https://ipinfo.io/" + ip + "/json?token=").then((res) => res.json());
        try {
          ipDetail = await fetch(
            "https://ipinfo.io/" + ip + "/json?token=" + appConfigs.ip_token2).then((res) => res.json());
          let ipData = await IpAddress.findOne({ where: { ip, ip } });
          if (ipData) {
            await IpAddress.update(
              {
                ip: ipDetail.ip,
                city: ipDetail.city,
                region: ipDetail.region,
                country: ipDetail.country,
                loc: ipDetail.loc,
                org: ipDetail.org,
                postal: ipDetail.postal,
                timezone: ipDetail.timezone,
              },
              { where: { ip: ip } }
            );
          } else {
            await IpAddress.create({
              ip: ipDetail.ip,
              city: ipDetail.city,
              region: ipDetail.region,
              country: ipDetail.country,
              loc: ipDetail.loc,
              org: ipDetail.org,
              postal: ipDetail.postal,
              timezone: ipDetail.timezone,
            });
          }
        } catch (err) {
          return
        }
      }
    } catch (e) {
      ipDetail = null;
    }
  }

};

// const getIpDetail = async (ip) => {
//   try {
//     let ipData = await IpAddress.findOne({
//       where: {
//         ip: ip,
//         updated_at: {
//           [Op.gte]: Sequelize.literal("NOW() - INTERVAL 2 DAY"),
//         },
//       },
//     });
//     let appConfigs = config("app");
//     if (ipData) {
//       return ipData.dataValues;
//     } else {
//       try {
//         ipDetail = await fetch(
//           "https://ipinfo.io/" + ip + "/json?token=" + appConfigs.ip_token1).then((res) => res.json());

//         let ipDataRes = await IpAddress.findOne({ where: { ip: ip } });

//         ipData = {
//           ip: ipDetail.ip,
//           city: ipDetail.city,
//           region: ipDetail.region,
//           country: ipDetail.country,
//           loc: ipDetail.loc,
//           org: ipDetail.org,
//           postal: ipDetail.postal,
//           timezone: ipDetail.timezone,
//         };
//         if (ipDataRes) {
//           await IpAddress.update(ipData, { where: { ip: ip } });
//           return ipData;
//         } else {
//           await IpAddress.create(ipData);
//           return ipDetail;
//         }

//       } catch (err) {
//         return
//       }
//     }
//   } catch (err) {
//     try {
//       let ipData = await IpAddress.findOne({
//         where: {
//           ip: ip,
//           updated_at: {
//             [Op.gte]: Sequelize.literal("NOW() - INTERVAL 2 DAY"),
//           },
//         },
//       });
//       let appConfigs = config("app");
//       if (ipData) {
//         return ipData.dataValues;
//       } else {
//         // ipDetail = await fetch("https://ipinfo.io/" + ip + "/json?token=").then((res) => res.json());
//         try {
//           ipDetail = await fetch(
//             "https://ipinfo.io/" + ip + "/json?token=" + appConfigs.ip_token2).then((res) => res.json());
//           let ipData = await IpAddress.findOne({ where: { ip, ip } });
//           if (ipData) {
//             await IpAddress.update(
//               {
//                 ip: ipDetail.ip,
//                 city: ipDetail.city,
//                 region: ipDetail.region,
//                 country: ipDetail.country,
//                 loc: ipDetail.loc,
//                 org: ipDetail.org,
//                 postal: ipDetail.postal,
//                 timezone: ipDetail.timezone,
//               },
//               { where: { ip: ip } }
//             );
//           } else {
//             await IpAddress.create({
//               ip: ipDetail.ip,
//               city: ipDetail.city,
//               region: ipDetail.region,
//               country: ipDetail.country,
//               loc: ipDetail.loc,
//               org: ipDetail.org,
//               postal: ipDetail.postal,
//               timezone: ipDetail.timezone,
//             });
//           }
//         } catch (err) {
//           return
//         }
//       }
//     } catch (e) {
//       ipDetail = null;
//     }
//   }

// };


const encrypt = (async (openai_key) => {
  try {
    let cipher = crypto.createCipheriv('aes-256-cbc', AES_ENCRYPTION_KEY, AES_ENCRYPTION_IV);
    let encrypted = cipher.update(openai_key, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  } catch (e) {
    return '';
  }
});

const decrypt = (api_key) => {
  try {
    let decipher = crypto.createDecipheriv('aes-256-cbc', AES_ENCRYPTION_KEY, AES_ENCRYPTION_IV);
    let decrypted = decipher.update(api_key, 'base64', 'utf8');
    return (decrypted + decipher.final('utf8'));
  } catch (e) {
    return ''
  }

};
// replace by getProjectData
const getProject = (async (res, project_uid) => {
  let project_data = await Project.findOne({
    where: {
      project_uid: project_uid
    }
  })
  if (!project_data) {
    return res.status(400).send({ type: "RXERROR", message: "Please provide a valid Project Uid" })
  }
  return project_data;
});

const getProjectData = (async (project_uid) => {
  let project_data = await Project.findOne({
    where: {
      project_uid: project_uid
    }
  })
  if (!project_data) {
    return null
  }
  return project_data;
});

const checkQueryCount = (async (res,project_id) => {
  let app_id =1;
  count_data = count_data.app_id[app_id];

  let project_usage = await ProjectUsage.findOne({
    where: {
      project_id: project_id
    }
  })

    if(!project_usage){
      await ProjectUsage.create({
          project_id:project_id,
          query_count:0
      })
    }
   
  if (project_usage) {
    let plan = project_usage.plan
    let query_count;
    let next_cycle_time = new Date(project_usage.next_cycle).getTime();
    let current_date = Date.now();
    let error_message;


    switch (plan) {
      case 'basic':

        query_count = count_data.basic.query_limit
        if (project_usage.query_count >= query_count) {
          error_message = "Your basic plan usage limit exceeded. Please choose a new plan on https://yourgpt.ai/pricing."
        }
        break;
      case 'starter_monthly':

        query_count = count_data.starter_monthly.query_limit
        if (project_usage.query_count >= query_count){
          error_message = "Your starter plan usage limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."
        } else if(next_cycle_time < current_date) {
          error_message = "Your starter plan has expired. Please renew it on https://yourgpt.ai/pricing."
        }
        break;
      case 'growth_monthly':

        query_count = count_data.growth_monthly.query_limit
        if (project_usage.query_count >= query_count){
          error_message = "Your growth plan usage limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."
        } else if(next_cycle_time < current_date) {
          error_message = "Your growth plan has expired. Please renew it on https://yourgpt.ai/pricing."
        }
        break;
      case 'professional_monthly':
      query_count = count_data.professional_monthly.query_limit
      if (project_usage.query_count >= query_count){
        error_message = "Your professional plan usage limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."

      } else if(next_cycle_time < current_date) {
        error_message = "Your professional plan has expired. Please renew it on https://yourgpt.ai/pricing."
      }
      break;

      case 'elite_monthly':
        query_count = count_data.elite_monthly.query_limit
        if (project_usage.query_count >= query_count){
          error_message = "Your elite plan usage limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."
  
        } else if(next_cycle_time < current_date) {
          error_message = "Your elite plan has expired. Please renew it on https://yourgpt.ai/pricing."
        }
        break;
    }
    return error_message
  
  }
});

const checkDocumentCount = (async (res,project_id,url_length) => {
  let app_id =1;
  count_data = count_data.app_id[app_id];
  let project_usage = await ProjectUsage.findOne({
    where: {
      project_id: project_id
    }
  })

  if(!project_usage){
    await ProjectUsage.create({
        project_id:project_id,
        document_count:0
    })
  }

  if (project_usage) {
    let plan = project_usage.plan
    let document_count;
    let next_cycle_time = new Date(project_usage.next_cycle).getTime();
    let current_date = Date.now();
    let error_message;


    switch (plan) {
      case 'basic':
        document_count = count_data.basic.document_limit
        if (project_usage.document_count >= document_count) {
          error_message = "Your basic plan document upload limit exceeded. Please choose a new plan on https://yourgpt.ai/pricing."
        }else if(document_count < url_length){
          error_message = "Your basic plan permits up to "+document_count+" documents."
        }
        break;

      case 'starter_monthly':

        document_count = count_data.starter_monthly.document_limit
        if (project_usage.document_count >= document_count){
          error_message = "Your starter plan document upload limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."
        } else if (next_cycle_time < current_date) {
          error_message = "Your starter plan has expired. Please renew it on https://yourgpt.ai/pricing."
        } else if (document_count>=url_length){
          error_message = "Your starter plan permits up to "+document_count+" documents."
        }
        break;

      case 'growth_monthly':

        document_count = count_data.growth_monthly.document_limit
        if (project_usage.document_count >= document_count){
          error_message = "Your growth plan document upload limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."
        } else if (next_cycle_time < current_date) {
          error_message = "Your growth plan has expired. Please renew it on https://yourgpt.ai/pricing."
        } else if (project_usage.document_count >= document_count){
          error_message = "Your growth plan permits up to "+document_count+" documents."
        }
        break;

      case 'professional_monthly':

      document_count = count_data.professional_monthly.document_limit
      if (project_usage.document_count >= document_count){
        error_message = "Your professional plan document upload limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."
      } else if (next_cycle_time < current_date) {
        error_message = "Your professional plan has expired. Please renew it on https://yourgpt.ai/pricing."
      } else if (project_usage.document_count >= document_count){
        error_message = "Your professional plan permits up to "+document_count+" documents."
      }
      break;

      case 'elite_monthly':

      document_count = count_data.elite_monthly.document_limit
      if (project_usage.document_count >= document_count){
        error_message = "Your elite plan document upload limit exceeded. Please upgrade plan on https://yourgpt.ai/pricing."
      } else if (next_cycle_time < current_date) {
        error_message = "Your elite plan has expired. Please renew it on https://yourgpt.ai/pricing."
      } else if (project_usage.document_count >= document_count){
        error_message = "Your elite plan permits up to "+document_count+" documents."
      }
      break;
    }

    return error_message
  
  }
});

const checkOrganizationLimit = async (data) => {
  const {organization_id , usage_type , project_id , app_id} = data
  const result = await UsageLimit.findOne({
    where : {
      organization_id : organization_id,
      limit_type : usage_type,
      project_id : project_id,
      app_id : app_id
    }
  })

  if (!result) {
    return {
      message : "no plan found"
    }
  }
  let checkOrganizationLimit
  if (data.project_id) {
    //   checkOrganizationLimit = await sequelize.query(`SELECT  u.plan_id, u.usage_type, SUM(u.usage_value) AS total_usage, ul.limit_value ,SUM(ul.limit_value) - SUM(u.usage_value) AS limit_left FROM usage_data u JOIN
    //   usage_limits ul ON u.plan_id = ul.plan_id
    //       AND u.app_id = ul.app_id
    //       AND u.usage_type = ul.limit_type
    //       AND u.organization_id = ul.organization_id
    //   WHERE
    //     u.usage_type = :usage_type
    //     AND u.organization_id = :organization_id
    //     AND u.app_id = :app_id
    //     AND u.project_id = :project_id
    //   GROUP BY u.plan_id , u.usage_type , ul.limit_value HAVING SUM(u.usage_value) < ul.limit_value;`,{
    // replacements:data,
    // type: QueryTypes.SELECT
    // })

    checkOrganizationLimit = await sequelize.query(`SELECT
    u.plan_id,
    u.usage_type,
    SUM(u.usage_value) AS total_usage,
    ul.limit_value,
    CASE
        WHEN ul.limit_value = '∞' THEN 'Unlimited'
        ELSE ul.limit_value - SUM(u.usage_value)
    END AS limit_left
    FROM
        usage_data u
    JOIN
        usage_limits ul ON u.plan_id = ul.plan_id
            AND u.app_id = ul.app_id
            AND u.usage_type = ul.limit_type
            AND u.organization_id = ul.organization_id
    WHERE
    u.usage_type = :usage_type
    AND u.organization_id = :organization_id
    AND u.app_id = :app_id
    AND u.project_id = :project_id
    GROUP BY
        u.plan_id, u.usage_type, ul.limit_value
    HAVING
        SUM(u.usage_value) < ul.limit_value OR ul.limit_value = '∞';
    `,{
    replacements:data,
    type: QueryTypes.SELECT
    })

    return {
      data : checkOrganizationLimit
    }
  }
  //   checkOrganizationLimit = await sequelize.query(`SELECT  u.plan_id, u.usage_type, SUM(u.usage_value) AS total_usage, ul.limit_value,SUM(ul.limit_value) - SUM(u.usage_value) AS limit_left FROM usage_data u JOIN
  //   usage_limits ul ON u.plan_id = ul.plan_id
  //       AND u.app_id = ul.app_id
  //       AND u.usage_type = ul.limit_type
  //       AND u.organization_id = ul.organization_id
  //   WHERE
  //       u.usage_type = :usage_type
  //       AND u.organization_id = :organization_id
  //       AND u.app_id = :app_id
  //   GROUP BY u.plan_id , u.usage_type , ul.limit_value HAVING SUM(u.usage_value) < ul.limit_value;`,{
  // replacements:data,
  // type: QueryTypes.SELECT
  // })

  checkOrganizationLimit = await sequelize.query(`SELECT
  u.plan_id,
  u.usage_type,
  SUM(u.usage_value) AS total_usage,
  ul.limit_value,
  CASE
      WHEN ul.limit_value = '∞' THEN 'Unlimited'
      ELSE ul.limit_value - SUM(u.usage_value)
  END AS limit_left
  FROM
    usage_data u
  JOIN
    usage_limits ul ON u.plan_id = ul.plan_id
        AND u.app_id = ul.app_id
        AND u.usage_type = ul.limit_type
        AND u.organization_id = ul.organization_id
  WHERE
  u.usage_type = :usage_type
  AND u.organization_id = :organization_id
  AND u.app_id = :app_id
  GROUP BY
    u.plan_id, u.usage_type, ul.limit_value
  HAVING
    SUM(u.usage_value) < ul.limit_value OR ul.limit_value = '∞';
  `,{
  replacements:data,
  type: QueryTypes.SELECT
  })

  return {
    data : checkOrganizationLimit
  }
}

const getOrganizationLimit = async (data) => {
  const {organization_id , usage_type , project_id , app_id} = data
  const result = await UsageLimit.findOne({
    where : {
      organization_id : organization_id,
      limit_type : usage_type,
      project_id : project_id,
      app_id : app_id
    }
  })

  if (!result) {
    return {
      message : "no plan found"
    }
  }
  let checkOrganizationLimit
  if (data.project_id) {
    checkOrganizationLimit = await sequelize.query(`SELECT
    u.plan_id,
    u.usage_type,
    SUM(u.usage_value) AS total_usage,
    ul.limit_value
    FROM
        usage_data u
    JOIN
        usage_limits ul ON u.plan_id = ul.plan_id
            AND u.app_id = ul.app_id
            AND u.usage_type = ul.limit_type
            AND u.organization_id = ul.organization_id
    WHERE
    u.usage_type = :usage_type
    AND u.organization_id = :organization_id
    AND u.app_id = :app_id
    AND u.project_id = :project_id
    GROUP BY
        u.plan_id, u.usage_type, ul.limit_value;
    `,{
    replacements:data,
    type: QueryTypes.SELECT
    })

    return {
      data : checkOrganizationLimit
    }
  }
  checkOrganizationLimit = await sequelize.query(`SELECT
  u.plan_id,
  u.usage_type,
  SUM(u.usage_value) AS total_usage,
  ul.limit_value
  FROM
      usage_data u
  JOIN
      usage_limits ul ON u.plan_id = ul.plan_id
          AND u.app_id = ul.app_id
          AND u.usage_type = ul.limit_type
          AND u.organization_id = ul.organization_id
  WHERE
  u.usage_type = :usage_type
  AND u.organization_id = :organization_id
  AND u.app_id = :app_id
  GROUP BY
      u.plan_id, u.usage_type, ul.limit_value;
  `,{
  replacements:data,
  type: QueryTypes.SELECT
  })

  return {
    data : checkOrganizationLimit
  }
}

/**
 * 
 * @param {*} whereCondition minimum key object for searching plan from usage_Data
 * @param {*} keyName the new key added in plan feature
 * @param {*} keyCount the total count of keyName data i.e purpose of keyName like if new key is chatbot then total no. of chatbot is the keyCount value
 * @returns valid if all good otherwise error object
 */
const checkUsageLimitForNewKey = async (whereCondition,keyName,keyCount = null) => {
  let usage_Data = await UsageData.findAll({
    where : whereCondition
  })
  if (usage_Data.length <= 0) {
      return res.status(400).send({
        type : "RXERROR",
        message : "plan not found"
      })            
  }

  let member_limit = usage_Data.find((item) => item.usage_type == keyName)
  let member_limit_count
  if (!member_limit) {
    whereCondition.status = {[Op.in]:["active","past_due"]}
    let subscription_data = await Subscription.findOne(whereCondition)
    if (!subscription_data) {
      return { type : "RXERROR", message : "Please purchase a plan" }
    }
    let plan_id = usage_Data[0].plan_id
    let plan = config('plan').plans[whereCondition.app_id]
    
    Object.keys(plan).forEach((plan_name) => {
        if (plan[plan_name].plan_id == plan_id) {
          member_limit_count = plan[plan_name].member
        }
    })
    logInfo(keyCount);
    if (keyCount == null) {
      return { type: "RXERROR", message: `Please enter ${keyName} count` }
    }
    
    if (keyCount >= member_limit_count) {
      return { type: "RXERROR", message: `You can not add member more then ${member_limit_count}` }
    }
    return "valid"
  }else{
    whereCondition.usage_type = keyName
    const limitCheck = await checkOrganizationLimit(whereCondition)
    logInfo(limitCheck);
    if(limitCheck?.data.length < 1){
      return {
        type: "RXERROR",
        message: "You have already reached the limit."
      }
    }else if(limitCheck?.message){
      return {
        type: "RXERROR",
        message: limitCheck.message
      }
    }else{
      return "valid"
    }
  }
}

const increaseLimit= async (by,data) => {
  await UsageData.increment('usage_value', { by: by, where: data});
}


const addToIndexQueue = (async (type,data) => {
  AWS.config.update({
    accessKeyId: config("aws").accessKeyId, // Access key ID
    secretAccessKey: config("aws").secretAccessKey, // Secret access key
    region: "eu-north-1" //Region
  });
  try{

    // Create an SQS service object
    var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

    let MessageGroupId=type;
    if(Array.isArray(data)){
      if(data.length>0){
        MessageGroupId  = type + "_" + data[0].project_id +"_"+ parseInt(Math.random()*5);
      }
    }else if (typeof data === 'object' && data !== null) {
      // Assuming 'data' is an object and has a 'project_id' property
      if (data.project_id) {
          MessageGroupId = type + "_" + data.project_id +"_"+ parseInt(Math.random()*5);
      }
  }
    
    var params = {
      // Remove DelaySeconds parameter and value for FIFO queues
      DelaySeconds: 0,
      MessageBody: JSON.stringify({
        type:type, // files,webpages
        data:data
      }),
      MessageDeduplicationId: Date.now().toString(),  // Required for FIFO queues
      MessageGroupId: MessageGroupId,  // Required for FIFO queues
      QueueUrl: "https://sqs.eu-north-1.amazonaws.com/948582588497/GPTIndexingQueue.fifo"
    };

    return new Promise((resolve,reject)=>{
      sqs.sendMessage(params, function(err, data) {
        if (err) {
          logInfo("Error", err);
          resolve(false)
        }else{
          logInfo("Success", data.MessageId);
          resolve(data.MessageId)
        }
      });
    })
  }catch(e){
      logInfo("IndexingQueueError",e)
      return true;
  }

});

const notifyOnDiscord = async (data, type=false) => {
  const discord = config('discord')

  let url = discord.url
  if(type!=false){
    url = discord[`${type}_url`]
  }

  try {
    const result = await fetch(url,{
      method : "POST",
      headers : {
        'Content-Type': 'application/json'
      },
      body : JSON.stringify({
        "content": data
      })
    })

    const response = await result.text();
    logInfo(response);
    return true
  } catch (error) {
    logInfo("error",error);
    return false
  }
}

const userActivityLog = async (req) => {
  let req_path = req.path;
  let checkStr = req_path.substring(1);
  let newStr = checkStr.split("/")[0]; 
  let action;
  let info=null ;
  switch(newStr){
    case 'getProjectDetail':
        action ='get_project_detail'
        info = 'project_detail'
        break;
    case 'getMyProjects':
      action = 'get_my_projects'
      let app_id = req.body.app_id;
      if(app_id ==1){
        info='accessed_chatbot'
      }if(app_id==2){
        info='accessed_qa_master'
      }if(app_id ==3){
        info='accessed_personal_assitant'
      }if(app_id==4){
        info='accessed_customer_support_expert'    
      }if(app_id==5){
        info='accessed_coding_mentor'    
      }if(app_id==6){
        info='accessed_content_writer'
      }
      break;
  }
  if(info==null){
    return false;
  }
  
  let user_id = req.authUser.user_id;
  let data;
  data = await UserActivityLog.create({
    user_id: user_id,
    action: action,
    info: info
  })
  return data;
}

const deleteQdrantDoc = async(projectSetting, document_id)=>{
  try{
    let { qdClient, collectionName }=getQdrantConfig(projectSetting)
    const response=await qdClient.delete(collectionName, {
      "filter": {
        "must": [
          {
            "key": "document_id",
            "match": {
              "value": document_id
            }
          }
        ]
      },
      "with_payload": true,
      "with_vector": false
    });
    logInfo("DELETE QDRANT DOC",response)
    if(response.status=="acknowledged"){
      return true;
    }
    return false;
  } catch (error) {
    logInfo("error",error);
    return false
  }
}

// vanillaJS
function isJsonString(str) {
  try {
      if(typeof str!="string"){
        str=JSON.stringify(str)
      }
      JSON.parse(str);
  } catch (e) {
      return false;
  }
  return true;
}
function generateRandomCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}
function isValidUrl(url) {
  const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name and extension
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?'+ // port
    '(\\/[-a-z\\d%_.~+]*)*'+ // path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(url);
}

function ArrayIncludes(searchString,valuesToCheck=[]){
  const includesValue = valuesToCheck.some(value => searchString.toLowerCase().includes(value.toLowerCase()));
  if (includesValue) {
    logInfo('The string includes at least one value from the array.');
    return true;
  } else {
    logInfo('The string does not include any value from the array.');
    return false;
  }
}

function isBotAvailable(availabilitySchedule) {
  if (!availabilitySchedule) return true;

 // if timezone is present use it otherwise utc is bydefault
  if (availabilitySchedule.timezone) {
      moment.tz.setDefault(availabilitySchedule.timezone);
  } else {
      moment.tz.setDefault('Etc/UTC');
  }

  const currentTime = moment();
  const currentDay = currentTime.format('dddd').toLowerCase();
  logInfo(currentTime,currentDay)

  // Check current day slots
  if (availabilitySchedule[currentDay]) {
      if(!Array.isArray(availabilitySchedule[currentDay])){return false;}

      for (let slot of availabilitySchedule[currentDay]) {
          const isWithinStartTime = currentTime.isSameOrAfter(moment(slot.start_time, 'HH:mm:ss'));
          const isBeforeEndTime = currentTime.isSameOrBefore(moment(slot.end_time, 'HH:mm:ss'));

          if (isWithinStartTime && isBeforeEndTime) {
              return true;
          }
      }
  }

  // Check festivals
  if (availabilitySchedule.festivals) {
      const festivalToday = availabilitySchedule.festivals.find(festival => moment(festival.date, 'YYYY-MM-DD').isSame(currentTime, 'day'));
      
      if (festivalToday && festivalToday.slots) {
          if(!Array.isArray(festivalToday.slots)){return false;}
          
          for (let slot of festivalToday.slots) {
              const isWithinStartTime = currentTime.isSameOrAfter(moment(slot.start_time, 'HH:mm:ss'));
              const isBeforeEndTime = currentTime.isSameOrBefore(moment(slot.end_time, 'HH:mm:ss'));

              if (isWithinStartTime && isBeforeEndTime) {
                  return true;
              }
          }
      }
  }

  return false;
}

const storeSessionMessageFallbackAILog = async(query_id,reply_id,logs,extraData=null)=>{
  logInfo("storeSessionMessageFallbackAILog",extraData)
  await SessionMessageFallbackAILog.create({
    query_message_id   : query_id,
    reply_message_id   : reply_id,
    execution_response : logs.execution_response,
    source_node        : logs.source_node,
    extra_data         : extraData
  })
  return true
}

const formatChatbotFunction = (data) => {
  if(!data || data.length == 0) return [];



  return data.map((item) => {
    return {
      type: "function",
      function: item.value,
      skill: item.type,
      settings: item.settings,
    };
  });
}

const keyValueToObject = function (data) {
  let obj = {}
  if (!data) return obj
  if (typeof data == "object" && Array.isArray(data)) {
      data.forEach(element => {
          obj[element.key] = element.value
      });
  }else if(typeof data == "object"){
      obj[key] = value
  }
  return obj
}

const randBigInt = () => {
  return Number(new Date().getTime()+String(rand(9999,1111)))
}

const addTrainingJob = async(job_id, config_data)=>{
      AWS.config.update({
          accessKeyId: config("aws").accessKeyId, // Access key ID
          secretAccessKey: config("aws").secretAccessKey, // Secret access key
          region: "eu-north-1" // Region
      });
      let eventbridge = new AWS.EventBridge({ apiVersion: '2015-10-07' });
      let result = await eventbridge.putEvents({
          Entries: [
              {
                  EventBusName: 'trainingJobs',
                  Source: 'acme.trainingJobsEvent',
                  DetailType: 'trainingJob',
                  Detail: JSON.stringify({job_id:job_id, config: config_data})
              }
          ]
      }).promise();
      logInfo("::::START TRAINING::::",result)
};

const checkSessionThrottlingLimit = async (chatbot_setting) => {
  let throttling_setting = isset(chatbot_setting.throttling_setting, null)
  let project_id = chatbot_setting.project_id
  if (throttling_setting) {
    let session_count = await Session.count({
      where: {
        project_id: project_id,
        is_emulator: 0,
        created_at: {
          [Op.gt]: Sequelize.literal(`NOW() - INTERVAL ${throttling_setting.session_limit.time} HOUR`)
        }
      }
    })
    if (session_count > throttling_setting.session_limit.limit) {
      return { error: true, message: throttling_setting.session_limit.message, total: session_count }
    }
  }
  return { error: false }
}

const checkSessionMessageThrottlingLimit = async (chatbot_setting, session_data) => {
  let throttling_setting = isset(chatbot_setting.throttling_setting, null)
  session_data = JSON.parse(JSON.stringify(session_data))
  if (throttling_setting && !session_data?.is_emulator && session_data?.chat_mode == "1") {
    let session_message_count = await SessionMessage.count({
      where: {
          session_id: session_data.id,
          created_at: {
            [Op.gt]: Sequelize.literal(`NOW() - INTERVAL ${throttling_setting.message_per_session_limit.time} HOUR`)
          }
      }
    })
    if (session_message_count > throttling_setting.message_per_session_limit.limit) {
      return { error: true, type: "RXERROR", message: throttling_setting.message_per_session_limit.message, total: session_message_count }
    }
  }
  return { error: false }
}
const getQdrantConfig=(projectSetting)=>{
  let vectordbTier = projectSetting.vectordb_tier;
  let qdClient;
  let collectionName;
  let { QdrantClient } = require('@qdrant/js-client-rest');

  if (vectordbTier === 1) {
      // or connect to Qdrant Cloud
      qdClient = new QdrantClient({
          url:  config('qdrant').qdrant_tier1_url,
          apiKey: config('qdrant').qdrant_tier1_key,
          port: ""
      });

      collectionName = 'YourGPTProject' + projectSetting.project_id;
  } else {
      qdClient = new QdrantClient({
        url:  config('qdrant').qdrant_tier2_url,
        apiKey: config('qdrant').qdrant_tier2_key,
        port: ""
      });
      if (projectSetting.embed_model === "text-embedding-3-small") {
          collectionName = 'YourGPTMultiOpenAIV3Small';
      } else if (projectSetting.embed_model === "text-embedding-3-large") {
          collectionName = 'YourGPTMultiOpenAIV3Large';
      } else if (projectSetting.embed_model === "text-embedding-ada-002") {
          collectionName = 'YourGPTMultiOpenAIAda002';
      } else {
          collectionName = 'YourGPTProject' + projectSetting.project_id;
      }
  }
  return {qdClient, collectionName};
}

const getEmbeddingConfig=(embedModel)=>{
  let model;
  let { OpenAIEmbedding } =require("llamaindex");
  let { openai_api_key } = config("openai");
  if (embedModel === "text-embedding-3-small") {
      model = "text-embedding-3-small";
  } else if (embedModel === "text-embedding-3-large") {
      model = "text-embedding-3-large";
  } else if (embedModel === "text-embedding-ada-002") {
      model = "text-embedding-ada-002";
  } else {
      model = "text-embedding-ada-002";
  }

  return new OpenAIEmbedding({ model: model, apiKey: openai_api_key });
}

const cleanVectordb = async (projectSetting)=>{
  const {qdClient, collectionName} = getQdrantConfig(projectSetting);
  
  if(projectSetting.vectordb_tier==1){
    logInfo("DELETING COLLECTION: ", collectionName)  
    const response=await qdClient.deleteCollection(collectionName)
    logInfo("response",response)
    return false;
  }else{
    logInfo("DELETING COLLECTION: ", collectionName)  
    const response=await qdClient.delete(collectionName, {
      filter: {
        must: [
          {
            key: "project_id",
            match: {
              value: projectSetting.project_id,
            },
          },
        ],
      },
    });
    logInfo("response",response)
    return false;
  }
}

function isStrongPassword(password) {
  const strongPasswordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
  return strongPasswordRegex.test(password);
}

// This function checks if a user has access to a chatbot based on their country and IP address.
const checkChatbotAccessControl = async (project_id, country, ip) => {
  // Log the function call with the provided parameters
  logInfo("checkChatbotAccessControl", project_id, country, ip);

  // If no project_id is provided, return an error
  if (!project_id) return { error: true, message: "Please provide a valid project id" };

  try {
    // Fetch the access control list for the given project_id
    let access_control_list = await ChatbotAccessControlList.findAll({
      where: {
        project_id: project_id
      }
    });

    // If the access control list is empty, allow access
    if (access_control_list.length == 0) return { error: false };

    // Convert the access control list to a JSON object
    access_control_list = JSON.parse(JSON.stringify(access_control_list));

    // Separate the access control list into whitelist and blocklist
    let whitlisted_data = access_control_list.filter(item => item.list_type == "whitelist");
    logInfo("whitlisted_data", whitlisted_data);
    let blocklisted_data = access_control_list.filter(item => item.list_type == "blocklist");

    // If there are whitelisted items
    if (whitlisted_data.length > 0) {
      let whitelistedCountry = whitlisted_data.filter(item => item.type == "country_code")
      if (whitelistedCountry.length > 0) {
        if (whitelistedCountry.find(item => item.value == country)) {
          if (blocklisted_data.find(item => item.type == "ip" && item.value == ip)) {
            return { error: true, message: "You are not allowed to access this chatbot" };
          }
          // Otherwise, allow access
          return { error: false };
        } else {
          // If the user's country is not whitelisted, deny access
          return { error: true, message: "You are not allowed to access this chatbot" };
        }
      }

      // Check if the user's IP is whitelisted
      let whitelistedIp = whitlisted_data.filter(item => item.type == "ip");
      if (whitelistedIp.length > 0) {
        if (whitelistedIp.find(item => item.value == ip)) {
          // If the user's IP is whitelisted, allow access
          return { error: false };
        } else {
          // If the user's IP is not whitelisted, deny access
          return { error: true, message: "You are not allowed to access this chatbot" };
        }
      }
    }

    // If there are no blocklisted items, allow access
    if (blocklisted_data.length == 0) {
      return { error: false };
    }

    // Check if the user is blocklisted
    let blockedUser = blocklisted_data.find(item => {
      if (item.type == "country_code") {
        return item.value.toLowerCase() == country.toLowerCase();
      } else if (item.type == "ip") {
        return item.value.toLowerCase() == ip.toLowerCase();
      } else {
        return false;
      }
    });

    // If the user is blocklisted, deny access
    if (blockedUser) {
      return { error: true, message: "You are not allowed to access this chatbot" };
    }

    // If none of the above conditions are met, allow access
    return { error: false };

  } catch (error) {
    // If there is an error in the try block, return an error
    return { error: true, message: "Something went wrong" };
  }
}

const parseContactNumber = (recipient) => {
  logInfo("parseContactNumber",recipient);
  // const phoneRegex = /^\+?[0-9]+$/;
  // if (phoneRegex.test(recipient)) recipient = `+${recipient}`;
  // Check if the recipient number starts with a '+'
  if (!recipient.startsWith('+')) {
    recipient = `+${recipient}`;
  }
  const parseNumber = parsePhoneNumber(recipient);
  if (parseNumber.valid) {
    // Format the phone number in the desired format
    return `+${parseNumber.countryCode}-${parseNumber.number.significant}`;  
  }
  return null;
}

function compileTemplate(stringifyNode, data) {
  try {
      // stringifyNode=stringifyNode.replaceAll(/[\r\n\t\v\f\\]/g, '');
      let template = Handlebars.compile(stringifyNode);
      return template(data)
  } catch (e) {
      logInfo("Handlebars Error", e)
      return stringifyNode
  }
}

function extractJSON(jsonString) {
  let startNodeIndex = jsonString.indexOf('{');
  let endNodeIndex = jsonString.lastIndexOf('}');
  jsonString = jsonString.substring(startNodeIndex, endNodeIndex + 1);
  return JSON.parse(jsonString);
}

const getSelfConversationData = async(filter)=>{
  let data = [];
  let { conversation_status, conversations, project_id, start_date, end_date } = filter;
  if(!conversation_status) {
      if (!conversations) {
          let session = await Session.findAll({ where: { project_id, created_at : { [Op.between]: [start_date, end_date] } } });
          if(session.length < 1) {
              return { data: [], filter: {...filter, status: "complete"} };
          };

          session = JSON.parse(JSON.stringify(session));
          conversation_status = session.map((session) => ({
              session_id: session.id,
              status: "incomplete"
          }));

        } else {
          conversation_status = conversations.split(",").map((session) => ({
            session_id: session,
            status: "incomplete"
          }));
        }
      filter.conversation_status = conversation_status;
  }
  if(conversation_status.length < 1) {
    return { data: [], filter: {...filter, status: "complete"} };
  };

  let index = conversation_status.findIndex((conversation) => conversation.status === "incomplete");
  if(index !== -1) {
      let session_messages = await SessionMessage.findAll({ where: { session_id: conversation_status[index].session_id } });
      conversation_status[index].status = "complete";
      if(session_messages.length < 1) return getSelfConversationData(filter);
      session_messages = JSON.parse(JSON.stringify(session_messages));
      for(let i=0; i<session_messages.length; i++) {
        let message = session_messages[i];
        if(message?.message && message.content_type === "text" && message.message !== "" ) {
          data.push({ from: message.send_by, content: message.message });
        }
      };
      let all_completed = conversation_status.every((conversation) => conversation.status === "complete");
      if(all_completed) return { data: data, filter: {...filter, status: "complete"} };
      return { data: data, filter: {...filter, status: "incomplete"} };
  };
  return { data: [], filter: {...filter, status: "complete"} };

};

function getISOWeek(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diffMs = date - startOfYear;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const week = Math.ceil((diffDays + 1) / 7);
  return week;
};

const validateUrl = (url) => {
  let regex = new RegExp('^(https?:\\/\\/)?(www\\.)?[a-zA-Z0-9-]+(\\.[a-zA-Z0-9-]+)*\\.[a-zA-Z]{2,}$');
  let match = regex.test(url);
  if(match == false) return false;
  regex = /^(https?:\/\/)?(www\.)?/;
  url = url.replace(regex, '');
  return url;
};

const getDomainInfo = async (domain, type) => {
  try {
    let { [type + '_project_id']: project_id, [type + '_auth_token']: auth_token } = config("vercel");

    let response = await fetch(`https://api.vercel.com/v10/projects/${project_id}/domains/${domain}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth_token}`
      }
    });

    let data = await response.json();
    if (response.ok) return { error: false, data };
    return { error: true, message: getVercelErrorMessage(response.status) };
  } catch (err) {
    console.log("VERCEL ERROR (getDomainInfo) =>", err.message);
    return { error: true, message: "Something went wrong" };
  }
};

const getDomainConfig = async (domain,type) => {
  try {
    let { [type + '_auth_token']: auth_token } = config("vercel");

    let response = await fetch(`https://api.vercel.com/v6/domains/${domain}/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth_token}`
      }
    });

    let data = await response.json();
    if (response.ok) return { error: false, data };
    return { error: true, message: getVercelErrorMessage(response.status) };
  } catch (err) {
    console.log("VERCEL ERROR (getDomainConfig) =>", err.message);
    return { error: true, message: "Something went wrong" };
  }
};

const addVercelDomain = async (domain,type) => {
  try {
    let { [type + '_project_id']: project_id, [type + '_auth_token']: auth_token } = config("vercel");

    let body = JSON.stringify({
      name: domain
    });

    let response = await fetch(`https://api.vercel.com/v10/projects/${project_id}/domains`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth_token}`
      },
      body
    });

    let data = await response.json();

    if (response.ok) {
      console.log("VERCEL DOMAIN ADDED DATA ::", data);
      if(!data.verified) return { error: false, message: "Set this following TXT records", data: data.verification.map((item)=> ({...item, name: item.domain.split(".")[0] }) ) };
       
      let { error, data: configData, message } = await getDomainConfig(domain,type);
      console.log("VERCEL DOMAIN CONFIG DATA ::", error, configData, message, domain);
      if (error) return { error: true, message };

      if(configData.misconfigured) {
        let record = {  type: "A", name: "@", value: "76.76.21.21" }
        if(domain.split(".").length > 2) record = {  type: "CNAME", name: domain.split(".")[0], value: "cname.yourgpt.ai" };
        return { error: false, message: "Set the following record on your DNS provider to continue", data: [record] };
      }
      return { error: false, message: "Domain added successfully", data: null };
    }
    return { error: true, message: getVercelErrorMessage(response.status) };
  } catch (err) {
    console.log("VERCEL ERROR ::", err.message);
    return { error: true, message: "Something went wrong" };
  }
};

const verifyVercelDomain = async (domain,type) => {
  try {
    let { error: domainError, data: domainData, message: domainMessage } = await getDomainInfo(domain,type);
    if (domainError) return { error: true, message: domainMessage };
    
    if(!domainData.verified) return { error: true, message: "Set this following TXT records", data: domainData.verification.map((item)=> ({...item, name: item.domain.split(".")[0] }) ) };
    
    let { error: configError, data: configData, message: configMessage } = await getDomainConfig(domain,type);
    if (configError) return { error: true, message: configMessage };

    if(configData.misconfigured) {
      let record = {  type: "A", name: "@", value: "76.76.21.21" }
      if(domain.split(".").length > 2){
        record = {  type: "CNAME", name: domain.split(".")[0], value: "cname.yourgpt.ai" }
      }
      return { error: true, message: "Set the following record on your DNS provider to continue", data: [record] };
    }
    return { error: false, data: {...domainData, ...configData} };
  } catch (err) {
    console.log("VERCEL ERROR =>", err.message);
    return { error: true, message: "Something went wrong" };
  }
};

const getVercelDomain = async (domain,type) => {
  try {
    let { error: domainError, data: domainData, message: domainMessage } = await getDomainInfo(domain,type);
    if (domainError) return { error: true, message: domainMessage, data: null };

    console.log("VERCEL DOMAIN DATA ::", domainData);
    if(!domainData.verified) return { error: false, message: "Set this following TXT records", data: domainData.verification.map((item)=> ({...item, name: item.domain.split(".")[0] }) ) };

    let { error: configError, data: configData, message: configMessage } = await getDomainConfig(domain,type);
    if (configError) return { error: true, message: configMessage, data: null };

    if(configData.misconfigured) {
      let record = {  type: "A", name: "@", value: "76.76.21.21" }
      if(domain.split(".").length > 2) record = {  type: "CNAME", name: domain.split(".")[0], value: "cname.yourgpt.ai" };
      return { error: false, message: "Set the following record on your DNS provider to continue", data: [record] };
    }
    return { error: false, message: "Domain verified successfully" };
  } catch (err) {
    console.log("VERCEL ERROR =>", err.message);
    return { error: true, message: "Something went wrong" };
  }
};

const removeVercelDomain = async(domain,type)=>{
  try{
    let { [type + '_project_id']: project_id, [type + '_auth_token']: auth_token } = config("vercel");

    let response = await fetch(`https://api.vercel.com/v9/projects/${project_id}/domains/${domain}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${auth_token}`
      }
    });

    if (response.ok) return { error: false };
    let data = await response.json();
    return { error: true, message: getVercelErrorMessage(response.status) };
  }catch(err){
    console.log("VERCEL ERROR ::", err.message);
    return { error: true, message: "Something went wrong" };
  }
};

const getVercelErrorMessage = (statusCode) => {
  switch (statusCode) {
    case 400:
      return "Bad Request: The request could not be understood or was missing required parameters.";
    case 401:
      return "Unauthorized: Your API token may be invalid. Please check your authentication.";
    case 403:
      return "Forbidden: You do not have permission to perform this action.";
    case 404:
      return "Not Found: The requested resource could not be found.";
    case 409:
      return "Conflict: The domain or resource already exists, or there is a conflict with an existing configuration.";
    case 429:
      return "Too Many Requests: You have hit the rate limit. Please try again later.";
    case 500:
      return "Internal Server Error: Something went wrong on Vercel's end. Please try again later.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
};

const generate_slug = async (slug, model, where_clause) => {
  slug = slug.trim().toLowerCase()
              .replace(/[^a-z0-9\s-]/g, "")      // Remove invalid characters (excluding space and hyphen)
              .replace(/\s+/g, "-")              // Replace multiple spaces with a single hyphen
              .replace(/-+/g, "-")               // Replace multiple hyphens with a single hyphen
              .replace(/^-+|-+$/g, "");          // Remove leading or trailing hyphens
  
  where_clause.slug = slug;
  let data = await model.findOne({ where: where_clause });
  if (data) {
    let isUnique = false;
    while (!isUnique) {
      slug = `${slug}-${rand(1000,9999)}`;
      where_clause.slug = slug;
      let check = await model.findOne({ where: where_clause });
      if (!check) {
        isUnique = true;
      }
    }
  }
  
  return slug;
};


module.exports = {
  formatJoiError,
  ucfirst,
  getProject,
  getProjectData,
  isset,
  strlen,
  strpos,
  count,
  rand,
  array_rand,
  shuffle,
  substr,
  in_array,
  authUser,
  validateGoogleRecaptchaToken,
  updateCoinsAndLedger,
  validateParameters,
  getIpDetail,
  loadEmailTemplate,
  userPrivilege,
  encrypt,
  decrypt,
  checkQueryCount,
  checkDocumentCount,
  createJwtToken,
  addToIndexQueue,
  checkOrganizationLimit,
  getOrganizationLimit,
  increaseLimit,
  notifyOnDiscord,
  deleteQdrantDoc,
  userActivityLog,
  isJsonString,
  generateRandomCode,
  isValidUrl,
  ArrayIncludes,
  isBotAvailable,
  checkUsageLimitForNewKey,
  storeSessionMessageFallbackAILog,
  formatChatbotFunction,
  keyValueToObject,
  randBigInt,
  apiAuth,
  domainAuth,
  addTrainingJob,
  checkSessionThrottlingLimit,
  checkSessionMessageThrottlingLimit,
  getQdrantConfig,
  getEmbeddingConfig,
  cleanVectordb,
  isStrongPassword,
  checkChatbotAccessControl,
  parseContactNumber,
  compileTemplate,
  extractJSON,
  getSelfConversationData,
  getISOWeek,
  validateUrl,
  getDomainInfo,
  getDomainConfig,
  addVercelDomain,
  verifyVercelDomain,
  getVercelDomain,
  removeVercelDomain,
  generate_slug
};
