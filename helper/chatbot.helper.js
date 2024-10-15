const { UsageData, SelfLearning,DiscordIntegrationsSetting,TelegramIntegrationsSetting,SlackIntegrationsSetting,WhatsappIntegrationsSetting,MessengerIntegrationsSetting,InstagramIntegrationsSetting,LineIntegrationsSetting, SessionMessage } = require("../app/Models");
const { ArrayIncludes,decrypt, getOrganizationLimit } = require("./helper")
let version = "v17.0";
let Op = require('sequelize').Op;
// Import the Google Cloud client library
const increaseUsageCredit = async(type, organization_id, extraData={})=>{
    let credit=1;
    if(type=='automated_response'){
        credit=1
    }else if(type=='ai_response'){
        // System Generated response
        if(!extraData.logs){
            await UsageData.increment('usage_value', { by: 1, where: { app_id:1, organization_id:organization_id,usage_type:'credits' }});
            return 1;
        }
        logInfo("extraData",extraData)
        let model="gpt-3.5-turbo";
        if(extraData.model){
            model=extraData.model
        }
        let executionCount=0
        if(extraData?.logs?.execution_response){
            executionCount=extraData.logs.execution_response.length
        }
          
        // Model Charges
        if(model && model.toLowerCase().includes("gpt-4-1106-preview")){
            credit=10
            if(extraData.functionCount){
                credit=credit + extraData.functionCount;
            }
            if(executionCount>1){
                credit=credit + ((executionCount-1)*5);
            }

        }else if(model && model.toLowerCase().includes("gpt-4")){
            credit=20
            if(extraData.functionCount){
                credit = credit + ((extraData.functionCount-1)*3);
            }

            if(executionCount>1){
                credit = credit + ((executionCount-1)*10);
            }
        }else{
            credit=1;
            if(extraData.functionCount){
                credit = credit + Math.round(extraData.functionCount/2);
            }

            if(executionCount>1){
                credit = credit + Math.round((executionCount-1)*1);
            }
        }

    }
    await UsageData.increment('usage_value', { by: credit, where: { app_id:1, organization_id:organization_id,usage_type:'credits' }});
    return credit;
}

// will implement later
const getAIResponse=async (input)=>{
    // request body
    let query               = input.query;
    let extra_context       = input.extra_context;
    let integration_id      = input.integration_id;
    let provider_session_id = input.provider_session_id;
    let project_data        = input.project_data;
    let chatbot_data        = input.chatbot_data;
    let project_id          = project_data.id
    let app_id              = project_data.id.app_id;
    let organization_id     = project_data.organization_id;
    let project_uid         = project_data.project_uid;


    let message = await getOrganizationLimit({app_id: app_id,project_id:null,organization_id:organization_id,usage_type : "credits"})
    logInfo(checkLimit);
    if(checkLimit?.data < 1){
        return {message: "You have already reached the limit.", error:true}
    }else if(checkLimit?.message){
        return {message: checkLimit.message, error:true }
    }
    let limit_value = checkLimit.data[0].limit_value.split('/')
    let use_customer_key = false
    let total_usage = checkLimit.data[0].total_usage
    if (limit_value.includes("∞")) {
        if (limit_value.length > 1) {
            if (total_usage >= limit_value[0]) {
                use_customer_key = true
            }
        }else{
            use_customer_key = true
        }
    }else if (checkLimit.data[0].total_usage >= limit_value) {
        return {message: "You have already reached the limit.", error:true}
    }
    logInfo(use_customer_key);
    
  
    const myAppId = uuidv4();
    // Check session data is found or not on the base of project_id and status
    let session_data = await Session.findOne({
        where:{
            provider_session_id:input.provider_session_id,
            project_id:project_id,
            integration_id:integration_id,
            status:"open"
        },
        order : [['id',"desc"]]
    })
    // if session_data not found then create 
    if(!session_data){
        session_data = await Session.create({
            session_uid: myAppId.substr(0, 8) + myAppId.substr(8, 4) + myAppId.substr(12, 4) + myAppId.substr(16, 4) + myAppId.substr(20),
            integration_id:integration_id,
            status:"open",
            device_type:null,
            platform:null,
            ip:null,
            country:null,
            project_id:data.id,
            provider_session_id:input.provider_session_id
        })
    }
    let session_id = session_data.id;

    if(typeof query=="object"){ 
        let enMessage="Apologies, I can only understand text messages. Please provide more information."
        if (check_chatbot_setting.attachment_default_response) {
            enMessage = check_chatbot_setting.attachment_default_response.en;
        }
        return { message: enMessage, session_id:session_id, chatbotSetting: check_chatbot_setting}
    }

    let auomatedReponseQuery=`SELECT id,response,escalate_to_human
    FROM yourgpt.automated_responses
    WHERE project_id=:project_id and is_enabled='1' and :query LIKE REPLACE(user_message, '*', '%') limit 1;`

    let automatedResponseData = await sequelize.query(auomatedReponseQuery,{
        type: QueryTypes.SELECT,
        replacements : {
            query : query,
            project_id : project_id
        },
    });

    if(automatedResponseData.length>0){
        automatedResponseData=automatedResponseData[0]
        let automateResponse={ message: automatedResponseData.response, chatbotSetting: check_chatbot_setting };
        if(automatedResponseData.escalate_to_human=="1"){
            automateResponse.escalate_to_human=1
        }
        await UsageData.increment('usage_value', { by: '1', where: { app_id:data.app_id, organization_id:data.organization_id,usage_type:'credits' }});
        return automateResponse;
    }


    if(typeof message.data!="undefined" && message.data.length<1){
        return  {message:"",error:true}
    }
    if(data){

        let message;        
        if(app_id ==1 || app_id ==2){
            let model=isset(data.projectSetting[0]['model'],null);
            let credit=1;
            if(model && model.toLowerCase().includes("gpt-4")){
                credit=20;
            }
            await UsageData.increment('usage_value', { by: credit, where: { app_id:data.app_id, organization_id:data.organization_id,usage_type:'credits' }});
        }   
            

        let prompt = isset(data.projectSetting[0]['prompt'],null);
        let messageData = await getQueryAdvanceType(query,project_uid,app_id,check_chatbot_setting.language,session_id,prompt,extra_context,use_customer_key, formatChatbotFunction(check_chatbot_setting.chatbot_functions), chatbot_setting)
        message=messageData.message;
    
        return {...JSON.parse(JSON.stringify(crispData)),message:message,logs:messageData.logs, session_id:session_id, chatbotSetting: check_chatbot_setting}
    
    }else{
        return {message:"Incorrect organisation or hash value",error:true}
    }
}

const checkUnableToAnswer=async(data)=>{
    let unableToAnswer=false
    if(data.unableToAnswer){
        unableToAnswer=true
    }
    let UnableToReplyArray=[
        "Apologies, As an AI assistant, I don't have enough information to answer this question.",
        "I don't have enough information to answer this question.",
        "hmm, i am not sure",
        "I am not sure",
        "Hmm, I'm not sure",
        "Hmm, I'm not sure. Is there anything else I can help you with?",
        "Apologies, As an AI assistant",
        "have enough information"
    ]
   
    if(ArrayIncludes(data.message,UnableToReplyArray)){
        unableToAnswer=true
    }
    
    if(unableToAnswer){
        await SelfLearning.create({
            project_id: data.project_id,
            session_id: data.session_id,
            detail: JSON.stringify({ "question": data.question,"response": data.message  }),
            detail_type : 'FAQ',
            type: 'unable_to_answer'
        })
    }
    return unableToAnswer
}

const addFeedbackToSelfLearning=async(data)=>{
    let last_user_message = await SessionMessage.findOne({
        where: {
            session_id: data.session_id,
            type: 'user',
            id: {
                [Op.lt]: data.message_id
            }
        },
        order: [['id', 'DESC']]
    })
    if (!last_user_message) {
        return false
    }
    let last_message = last_user_message.message
    await SelfLearning.create({
        project_id: data.project_id,
        session_id: data.session_id,
        detail: JSON.stringify({ "question": last_message,"response": data.message  }),
        detail_type : 'FAQ',
        type: data.rate == 1 ? 'like' : 'dislike'
    })
    return true
}

// send messege on the bases of integration id
async function sendMessageToIntegration(integration_id,project_id,provider_session_id,message){
    logInfo(integration_id);
    switch (Number(integration_id)) {
        case 15:
            return await sendMessageToDiscord(project_id,provider_session_id,message)
            break;
        case 10:
            return await sendMessageToTelegram(project_id,provider_session_id,message)
            break;
        case 16:
            return await sendMessageToSlack(project_id,provider_session_id,message)
            break;
        case 13:
            return await sendMessageToWhatsapp(project_id,provider_session_id,message)
            break;
        case 11:
            return await sendMessageToMessenger(project_id,provider_session_id,message)
            break;
        case 12:
            return await sendMessageToInstagram(project_id,provider_session_id,message)
            break;
        case 14:
            return await sendMessageToLine(project_id,provider_session_id,message)
            break;
        default:
            // If the integration ID is incorrect or missing, there won't be anything sent anywhere.
            return false
            break;
    }
}
// send message to discord app on the room in which session associated i.e provider_id
async function sendMessageToDiscord(project_id,provider_session_id,message){
    // logInfo("sendMessageToDiscord",project_id,responseData);
    let discord_data = await DiscordIntegrationsSetting.findOne({
        where : {
            project_id : project_id
        }
    })
    let access_token = await decrypt(discord_data.access_token)
    const response = await fetch(`https://discord.com/api/channels/${provider_session_id}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bot ${access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content:message}),
    });
    let result = await response.json()
    if (typeof result?.id == "undefined") {
        return false
    }
    return true
}
// send message to telegram app on the room in which session associated i.e provider_id
async function sendMessageToTelegram(project_id,provider_session_id,message){
    // logInfo("sendMessageToDiscord",project_id,responseData);
    let data = await TelegramIntegrationsSetting.findOne({
        where : {
            project_id : project_id
        }
    })
    let access_token = await decrypt(data.bot_token)
    logInfo(`https://api.telegram.org/bot${access_token}/sendMessage`);
    const response = await fetch(`https://api.telegram.org/${access_token}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            chat_id : provider_session_id,
            text:message
        }),
    });
    let result = await response.json()
    logInfo("TelegramIntegrationsSetting",result);
    if (!result?.ok) {
        return false
    }
    return true
}
// send message to slack app on the room in which session associated i.e provider_id
async function sendMessageToSlack(project_id,provider_session_id,message){
    // logInfo("sendMessageToDiscord",project_id,responseData);
    let data = await SlackIntegrationsSetting.findOne({
        where : {
            project_id : project_id
        }
    })
    let access_token = await decrypt(data.access_token)
    logInfo(`https://slack.com/api/chat.postMessage`);
    const response = await fetch(`https://slack.com/api/chat.postMessage`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            channel : provider_session_id,
            text:message
        }),
    });
    let result = await response.json()
    logInfo("SlackIntegrationsSetting",result);
    if (!result?.ok) {
        return false
    }
    return true
}
// send message to whats app on the room in which session associated i.e provider_id
async function sendMessageToWhatsapp(project_id,provider_session_id,message){
    // logInfo("sendMessageToDiscord",project_id,responseData);
    let data = await WhatsappIntegrationsSetting.findOne({
        where : {
            project_id : project_id
        }
    })
    let access_token = await decrypt(data.access_token)
    logInfo(`https://graph.facebook.com/v17.0/${data.phone_number_id}/messages`);
    const response = await fetch(`https://graph.facebook.com/v17.0/${data.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            "messaging_product": "whatsapp",
            to : provider_session_id,
            text:{body : message}
        }),
    });
    let result = await response.json()
    logInfo("SlackIntegrationsSetting",result);
    if (!result?.error) {
        return false
    }
    return true
}
// send message to discord messenger app on the room in which session associated i.e provider_id
async function sendMessageToMessenger(project_id,provider_session_id,message){
    // logInfo("sendMessageToDiscord",project_id,responseData);
    let data = await MessengerIntegrationsSetting.findOne({
        where : {
            project_id : project_id
        }
    })
    let access_token = await decrypt(data.access_token)
    let body
    let requestOptions = {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: body,
        redirect: 'follow'
    };
    requestOptions.body = JSON.stringify({
        recipient: { id: provider_session_id },
        messaging_type: "RESPONSE",
        message: {
            "text": message
          },
        access_token: access_token
      })
    let URL = `https://graph.facebook.com/${version}/${data.page_id}/messages`
    let reponse=await fetch(URL, requestOptions).then(res=>res.json())
    logInfo(reponse)
    if (!reponse?.error) {
        return false
    }
    return true
}
// send message to instagram app on the room in which session associated i.e provider_id
async function sendMessageToInstagram(project_id,provider_session_id,message){
    // logInfo("sendMessageToDiscord",project_id,responseData);
    let data = await InstagramIntegrationsSetting.findOne({
        where : {
            project_id : project_id
        }
    })
    let access_token = await decrypt(data.access_token)
    let body
    let requestOptions = {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: body,
        redirect: 'follow'
    };
    requestOptions.body = JSON.stringify({
        recipient: { id: provider_session_id },
        messaging_type: "RESPONSE",
        message: {
            "text": message
          },
        access_token: access_token
      })
    let URL = `https://graph.facebook.com/${version}/${data.page_id}/messages`
    let reponse=await fetch(URL, requestOptions).then(res=>res.json())
    logInfo(reponse)
    if (!reponse?.error) {
        return false
    }
    return true
}
// send message to line app on the room in which session associated i.e provider_id
async function sendMessageToLine(project_id,provider_session_id,message){
    // logInfo("sendMessageToDiscord",project_id,responseData);
    let data = await LineIntegrationsSetting.findOne({
        where : {
            project_id : project_id
        }
    })
    let access_token = await decrypt(data.access_token)
    let body
    let requestOptions = {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${access_token}`
        },
        body: body,
        redirect: 'follow'
    };
    requestOptions.body = JSON.stringify({
        to: provider_session_id,
        messages: [{
            "type":"text",
            "text": message
          }]
      })
    let URL = `https://api.line.me/v2/bot/message/push`
    let reponse=await fetch(URL, requestOptions).then(res=>res.json())
    logInfo(reponse)
    if (!reponse?.error) {
        return false
    }
    return true
}

const checkCredits = async function (organization_id) {
    const checkLimit = await getOrganizationLimit({ organization_id: organization_id, app_id: "1", project_id: null, usage_type: "credits" })
    logInfo("getOrganizationLimit",checkLimit);
    if (checkLimit?.data < 1) {
        return { type: "RXERROR", message: "You have already reached the limit." }
    } else if (checkLimit?.message) {
        return { type: "RXERROR", message: checkLimit.message }
    }
    let limit_value = checkLimit.data[0].limit_value.split('/')[0]
    
    let use_customer_key = false
    let total_usage = checkLimit.data[0].total_usage
    if (limit_value.includes("∞")) {
        if (limit_value.length > 1) {
            if (Number(total_usage) >= Number(limit_value[0])) {
                use_customer_key = true
            }
        } else {
            use_customer_key = true
        }

    } else if (Number(checkLimit.data[0].total_usage) >= Number(limit_value)) {
        return { type: "RXERROR", message: "You have already reached the limit." }
    }

    return { type: "RXSUCCESS", data: { use_customer_key: use_customer_key } }
};

const emailVerify = async (mail) => {
    let key = config("mail").million_verify_api_key;
    try {
      let email_data = await Promise.race([
        fetch(`https://api.millionverifier.com/api/v3/?api=${key}&email=${mail}&timeout=30000`).then(res => res.json()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Verification timeout')), 30000))
      ]);
      if(email_data.result === 'invalid'){
        return false;
      }
      return true;
    } catch (error) {
      logInfo("ERROR:", error.message);
      return true;
    }
  };
  
const autoSwitchProvider=(model)=>{
    if(model.includes("/")){
      return "openrouter";
    }
    return "openai";
}

async function detectLanguage(text) {
    const { TranslationServiceClient } = require('@google-cloud/translate').v3;
    const client = new TranslationServiceClient({credentials:config('googleTranslate')});
    const projectId = config("googleTranslate").project_id;
    const location = 'us-central1';
    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      content: text,
    };
    const [response] = await client.detectLanguage(request);
    logInfo(`Detected language: ${response.languages[0].languageCode}`);
    return response.languages[0].languageCode;
}

async function googleTranslateText({text,targetLanguageCode}) {
    if (!text) throw new Error("Text is required");
    if (typeof text === "string") {
        text = [text]       
    } else if (!Array.isArray(text)) {
        throw new Error("Text should be string or array of strings");
    }
    targetLanguageCode = targetLanguageCode ? targetLanguageCode : "en";
    // Create a client
    const { TranslationServiceClient } = require('@google-cloud/translate').v3;
    const client = new TranslationServiceClient({credentials:config('googleTranslate')});
    // The project ID and location
    const projectId = config("googleTranslate").project_id;
    const location = 'us-central1';
  
    // The request
    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: text,
      mimeType: 'text/plain', // mime types: text/plain, text/html
    //   sourceLanguageCode: 'en',
      targetLanguageCode: targetLanguageCode,
    };
  
    // Translate text
    const [response] = await client.translateText(request);
    logInfo(response);
    return response.translations;    
}


module.exports = {
    increaseUsageCredit,
    getAIResponse,
    checkUnableToAnswer,
    sendMessageToIntegration,
    checkCredits,
    emailVerify,
    autoSwitchProvider,
    addFeedbackToSelfLearning,
    googleTranslateText,
    detectLanguage
}