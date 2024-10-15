require("../bin/kernel");
let fetch=require('node-fetch');
let session = controller("Api/Users/Project/SessionController");
let crisp = controller("Api/Users/Integration/CrispController");
let subscription = controller("Api/Users/Subscription/SubscriptionController");
let project_url  = controller("Api/Users/Project/ProjectUrlController");
let slack        = controller("Api/Users/Product/Chatbot/Integrations/SlackController");
let chatbot_job  = controller("Api/Users/Product/Chatbot/ChatbotJobController");

  
  /**
    * joinHandler function
    * 
    */
  module.exports.keepFunctionHot = async (event, context) => {

    // let pythonAPIStatus=await fetch(env('PYTHON_URL')+"status").then(res=>res.json())
    // logInfo("Python API status",pythonAPIStatus)

    let nodejsAPIStatus=await fetch("https://api.yourgpt.ai/api/v1/status").then(res=>res.json())
    logInfo("Nodejs API status",nodejsAPIStatus)
  
    let botsStatus=await fetch("https://bots.yourgpt.ai/api/v1/status").then(res=>res.json())
    logInfo("Bots status",botsStatus)
  
    // return response success
    return {
      statusCode: 200,
    };
  }

  /**
    * joinHandler function
    * 
    */
  module.exports.sendChatBotConversationOnEmailHandler = async (event, context) => {
    logInfo("BEFORE sendChatBotConversationOnEmail",event);
    await session.sendChatBotConversationOnEmail();
    logInfo("AFTER sendChatBotConversationOnEmail",event);

    // return response success
    return {
      statusCode: 200,
    };
  }
    /**
    * crispChatWebHookHandler function
    * 
    */
    module.exports.crispChatWebHookHandler = async (event, context) => {
      logInfo("Superman")
      logInfo(event.detail);

      await crisp.crispChatWebHookHandler(event.detail)

      return {
        statusCode: 200,
      };
    } 
    

    module.exports.limitQuotaHandler = async (event, context) => {
      logInfo("Sendimg limitQuotaHandler email")

      await subscription.sendEmailOnTrialLimitReached();
      await subscription.sendEmailOnLimitReached();

      return {
        statusCode: 200,
      };
    } 

    module.exports.reIndexUrlHandler = async(event,context)=>{
      await project_url.reIndexUrlCron();

      return {
        statusCode:200
      }
    }
  
    module.exports.chatbotIntegrationWebhookHandler=async (event, context)=>{
      logInfo("Chatbot Integration")
      // logInfo(event.detail);

      let detail=event.detail;

      if(detail.integration_id=="16"){
        await slack.slackWebHookHandler(detail.data);
      }
     

      return {
        statusCode:200
      }
    }

    module.exports.chatbotFlowEventBusHandler=async (event, context)=>{
      let { syncEventEmitter } = require("../app/Controllers/Api/Users/Product/Chatbot/Flows/ChatbotEventHandler");
      logInfo("Chatbot Flow Event")
      logInfo(event.detail);
      let detail=event.detail;
      await syncEventEmitter(detail.event,detail.data);
     
      return {
        statusCode:200
      }
    }

  /**
   * start crisping training from conversation
   * 
   */ 
  module.exports.trainingJobEventHandler = async (eventData, context)=>{
      logInfo("trainingJobEventHandler Running Fine!")
      logInfo(eventData.detail);
      let { job_id, config } = eventData.detail;
      await chatbot_job.handleTrainingJob(job_id, config);
  
      return {
      statusCode:200
    }
}



  module.exports.sendVisitorUnSeenChatBotConversationOnEmailHandler = async (event, context)=>{
    logInfo("BEFORE sendVisitorUnSeenChatBotConversationOnEmailHandler",event);
    await session.sendUserUnSeenChatBotConversationOnEmail();
    logInfo("AFTER sendVisitorUnSeenChatBotConversationOnEmailHandler",event);
  }

  module.exports.sendOperatorUnSeenChatBotConversationOnEmailHandler = async (event, context)=>{
    logInfo("BEFORE sendOperatorUnSeenChatBotConversationOnEmail",event);
    await session.sendOperatorUnSeenChatBotConversationOnEmail();
    logInfo("AFTER sendOperatorUnSeenChatBotConversationOnEmail",event);
  }