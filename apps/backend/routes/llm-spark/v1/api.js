let express = require("express");
let router = express.Router();
let Auth = middleware('Auth');

let llm = controller("Api/Users/Product/LLM-spark/LLMController");
let deployed_prompt = controller("Api/Users/Product/LLM-spark/DeployedPromptController");
let prompt_template = controller("Api/Users/Product/LLM-spark/PromptTemplateController");

// ------- LLM STUDIO ------- //

router.post("/createWorkspace",[Auth], (req, res) => {
    return llm.createWorkspace(req, res);
  }) , 
  
  router.post("/getMyWorkSpace",[Auth], (req, res) => {
    return llm.getMyWorkSpace(req, res);
  })
  
  router.post("/getWorkSpaceDetail",[Auth], (req, res) => {
    return llm.getWorkSpaceDetail(req, res);
  })
  
  
  // ------- PROMPT SCENARIO HISTORY ------- //
  
  router.post("/savePromptScenarioHistory",[Auth], (req, res) => {
    return llm.savePromptScenarioHistory(req, res);
  })
  
  router.post("/getPromptScenarioFile",[Auth], (req, res) => {
    return llm.getPromptScenarioFile(req, res);
  })
  
  router.post("/updatePrompScenariohistory",[Auth], (req, res) => {
    return llm.updatePrompScenariohistory(req, res);
  })
  
  router.post("/deletePrompScenariohistory",[Auth], (req, res) => {
    return llm.deletePrompScenariohistory(req, res);
  })
  
  router.post("/getSignedUrl",[Auth], (req, res) => {
    return llm.getSignedUrl(req, res);
  })
  
  router.post("/getAllPromptScenarioHistory",[Auth], (req, res) => {
    return llm.getAllPromptScenarioHistory(req, res);
  })
  
  router.post("/updateProjectSetting",[Auth], (req, res) => {
    return llm.updateProjectSetting(req, res);
  })
  
  router.post("/inviteProjectMember",[Auth], (req, res) => {
    return llm.inviteProjectMember(req, res);
  })

  router.post("/addMemberViaHash",[Auth], (req, res) => {
    return llm.addMemberViaHash(req, res);
  })

  router.post("/getProjectMembers",[Auth], (req, res) => {
    return llm.getProjectMembers(req, res);
  })
  
  router.post("/removeProjectMember",[Auth], (req, res) => {
    return llm.removeProjectMember(req, res);
  })

  router.post("/removeInvitationByHash",[Auth], (req, res) => {
    return llm.removeInvitationByHash(req, res);
  })

  //----- DEPLOYED PROMPT -----//
  
  router.post("/deployPrompt",[Auth], (req, res) => {
    return deployed_prompt.deployPrompt(req, res);
  })
  
  router.post("/getAllDeployPrompt",[Auth], (req, res) => {
    return deployed_prompt.getAllDeployPrompt(req, res);
  })
  
  router.post("/getMyDeployPrompt",[Auth], (req, res) => {
    return deployed_prompt.getMyDeployPrompt(req, res);
  })
  
  router.post("/updateDeployPrompt",[Auth], (req, res) => {
    return deployed_prompt.updateDeployPrompt(req, res);
  })
  
  router.post("/deleteDeployPrompt",[Auth], (req, res) => {
    return deployed_prompt.deleteDeployPrompt(req, res);
  })
  
  router.post("/getRequestLogs", [Auth], (req, res) => {
    return deployed_prompt.getRequestLogs(req, res);
  });

  router.post("/analytics", [Auth], (req, res) => {
    return deployed_prompt.analytics(req, res);
  });

  router.post("/getAnalyticsStatCount", [Auth], (req, res) => {
    return deployed_prompt.getAnalyticsStatCount(req, res);
  });
  //----- PROMPT TEMPLATE -----//
  
  router.post("/getAllPromptTemplates",[Auth], (req, res) => {
    return prompt_template.getAllPromptTemplates(req, res);
  })
  module.exports = router;