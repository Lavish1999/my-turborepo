let express = require("express");
let router = express.Router();
let Auth = middleware('Auth');
let APIAuth = middleware('APIAuth');
let user = controller("Api/Users/User/UserController");
let organization = controller("Api/Users/Organization/OrganizationController");
let project = controller("Api/Users/Project/ProjectController");
let projectIndex = controller("Api/Users/Project/ProjectIndexController");
let projectUrl = controller("Api/Users/Project/ProjectUrlController");
let projectFile = controller("Api/Users/Project/ProjectFileController");
let projectDomain = controller("Api/Users/Project/ProjectDomainController");
let projectMember = controller("Api/Users/Project/ProjectMemberController");
let projectText = controller("Api/Users/Project/ProjectTextController");
let prompt = controller("Api/Users/Project/PromptController");
let Subscription = controller("Api/Users/Subscription/SubscriptionController");
let Invoice = controller("Api/Users/Subscription/InvoiceController");

router.post("/socialLogin", [], (req, res) => {
  return user.socialLogin(req, res);
});

router.post("/login", [], (req, res) => {
  return user.login(req, res);
});

router.post("/generateSSOToken", [Auth], (req, res) => {
  return user.generateSSOToken(req, res);
});

router.post("/updateProfile", [Auth], (req, res) => {
  return user.updateProfile(req, res);
});

router.post("/register", [], (req, res) => {
  return user.register(req, res);
});

router.post("/sendResetEmail", [], (req, res) => {
  return user.sendResetEmail(req, res);
});

router.post("/resetPassword", [], (req, res) => {
  return user.resetPassword(req, res);
});

router.post("/changePassword", [Auth], (req, res) => {
  return user.changePassword(req, res);
});

router.post("/verifyEmail", [], (req, res) => {
  return user.verifyEmail(req, res);
});

router.post("/resendEmailVerification", (req, res) => {
  return user.resendEmailVerification(req, res);
});


router.post("/getDetail", [Auth], (req, res) => {
  return user.getDetail(req, res);
});
router.post("/sendEmailSubscriptionPromocode", [], (req, res) => {
  return user.sendEmailSubscriptionPromocode(req, res);
});

router.post("/logout", [Auth], (req, res) => {
  return user.logout(req, res);
});

router.post("/updateFcmToken", [Auth], (req, res) => {
  return user.updateFcmToken(req, res);
});

router.post("/subscribeNewsletter", [], (req, res) => {
  return user.subscribeNewsletter(req, res);
});

router.post("/getUserCommunityAndRewards", [Auth], (req, res) => {
  return user.getUserCommunityAndReward(req, res);
});

router.get("/discord/connected-account/redirect", [], (req, res) => {
  return user.discordConnectedAccountRedirectUrl(req, res);
});

router.post("/removeConnectedDiscordAccount", [Auth], (req, res) => {
  return user.removeConnectedDiscordAccount(req, res);
});

router.post("/getConnectedDiscordAccount", [Auth], (req, res) => {
  return user.getConnectedDiscordAccount(req, res);
});

router.post("/createOrganization", [Auth], (req, res) => {
  return organization.createOrganization(req, res);
});

router.post("/inviteOrganizationMember", [Auth], (req, res) => {
  return organization.inviteOrganizationMember(req, res);
});

router.post("/addOrganizationMemeberViaHash", [Auth], (req, res) => {
  return organization.addOrganizationMemeberViaHash(req, res);
});

router.post("/getMyOrganizations", [Auth], (req, res) => {
  return organization.getMyOrganizations(req, res);
});

router.post("/updateOrganization", [Auth], (req, res) => {
  return organization.updateOrganization(req, res);
});

router.post("/removeOrganizationMember", [Auth], (req, res) => {
  return organization.removeOrganizationMember(req, res);
});

router.post("/getOrganizationMembers", [Auth], (req, res) => {
  return organization.getOrganizationMembers(req, res);
});

router.post("/getOrganizationDetail", [Auth], (req, res) => {
  return organization.getOrganizationDetail(req, res);
});

router.post("/deleteOrganization", [Auth], (req, res) => {
  return organization.deleteOrganization(req, res);
});


router.post("/createProject", [Auth], (req, res) => {
  return project.createProject(req, res);
});

router.post("/deleteProject", [Auth], (req, res) => {
  return project.deleteProject(req, res);
});

router.post("/searchIndexDocument", [Auth], (req, res) => {
  return project.searchIndexDocument(req, res);
});

router.post("/updateIndexPointText", [Auth], (req, res) => {
  return project.updateIndexPointText(req, res);
});

router.post("/removeIndexPoint", [Auth], (req, res) => {
  return project.removeIndexPoint(req, res);
});


router.post("/updateProject", [Auth], (req, res) => {
  return project.updateProject(req, res);
});

router.post("/getProjectDetail", [Auth], (req, res) => {
  return project.getProjectDetail(req, res);
});

router.post("/getTrainingStatus", [Auth], (req, res) => {
  return project.getTrainingStatus(req, res);
});



router.post("/getMyProjects", [Auth], (req, res) => {
  return project.getMyProjects(req, res);
});

router.post("/generateProjectKey", [Auth], (req, res) => {
  return project.generateProjectKey(req, res);
});

router.post("/getProjectKey", [Auth], (req, res) => {
  return project.getProjectKey(req, res);
});

router.post("/deactivateProjectKey", [Auth], (req, res) => {
  return project.deactivateProjectKey(req, res);
});

router.post("/activateProjectKey", [Auth], (req, res) => {
  return project.activateProjectKey(req, res);
});
router.post("/deleteProjectKey", [Auth], (req, res) => {
  return project.deleteProjectKey(req, res);
})

router.post("/getProjectDetail", [Auth], (req, res) => {
  return project.getProjectDetail(req, res);
})

router.post("/migrateVectordbTier", [Auth], (req, res) => {
  return project.migrateVectordbTier(req, res);
})
// router.post("/reIndexUrlCron", [], async(req, res) => {
//   return res.send(await projectUrl.reIndexUrlCron());
// })
router.post("/createIndex", [Auth], (req, res) => {
  return projectIndex.createIndex(req, res);
});
router.post("/updateIndex", [Auth], (req, res) => {
  return projectIndex.updateIndex(req, res);
});

router.post("/deleteIndex", [Auth], (req, res) => {
  return projectIndex.deleteIndex(req, res);
});

router.post("/uploadFile", [Auth], (req, res) => {
  return projectFile.uploadFile(req, res);
});

router.post("/getProjectFiles", [Auth], (req, res) => {
  return projectFile.getProjectFiles(req, res);
});

router.post("/deleteFile", [Auth], (req, res) => {
  return projectFile.deleteFile(req, res);
});

router.post("/deleteFiles", [Auth], (req, res) => {
  return projectFile.deleteFiles(req, res);
});

router.post("/renameFile", [Auth], (req, res) => {
  return projectFile.renameFile(req, res);
});

router.post("/getProjectFileSignedUrl",[Auth], (req, res) => {
  return projectFile.getProjectFileSignedUrl(req, res);
})

router.post("/updateChatbotFileExtraSettings",[Auth],(req, res) => {
  return projectFile.updateChatbotFileExtraSettings(req, res);
});

router.post("/createProjectDomain",[Auth], (req, res) => {
  return projectDomain.createProjectDomain(req, res);
})

router.post("/deleteProjectDomain",[Auth], (req, res) => {
  return projectDomain.deleteProjectDomain(req, res);
})

router.post("/getProjectDomains",[Auth], (req, res) => {
  return projectDomain.getProjectDomains(req, res);
})

router.post("/getProjectMembers",[Auth], (req, res) => {
  return projectMember.getProjectMembers(req, res);
})

router.post("/removeProjectMember",[Auth], (req, res) => {
  return projectMember.removeProjectMember(req, res);
})

router.post("/inviteProjectMember",[Auth], (req, res) => {
  return projectMember.inviteProjectMember(req, res);
})

router.post("/addProjectMemeberViaHash",[], (req, res) => {
  return projectMember.addProjectMemeberViaHash(req, res);
})

// ********************** ProjectUrl *****************************

router.post("/createProjectUrl",[Auth], (req, res) => {
  return projectUrl.createProjectUrl(req, res);
})

router.post("/getProjectUrl",[Auth], (req, res) => {
  return projectUrl.getProjectUrl(req, res);
})
router.post("/reIndexUrl",[Auth], (req, res) => {
  return projectUrl.reCrawlProjectUrl(req, res);
})


router.post("/bulkReIndexUrl",[Auth], (req, res) => {
  return projectUrl.bulkReIndexUrl(req, res);
})

router.post("/deleteProjectUrl",[Auth], (req, res) => {
  return projectUrl.deleteProjectUrl(req, res);
})

router.post("/bulkDeleteProjectUrl",[Auth], (req, res) => {
  return projectUrl.bulkDeleteProjectUrl(req, res);
})

router.post("/updateProjectUrlExtraSettings",[Auth], (req, res) => {
  return projectUrl.updateProjectUrlExtraSettings(req, res);
})

router.post("/chatbot/updateChatbotSetting",[Auth], (req, res) => {
  return chatbot.updateChatbotSetting(req, res);
})
router.post("/chatbot/updateSearchWidgetSetting",[Auth], (req, res) => {
  return chatbot.updateSearchWidgetSetting(req, res);
})

router.post("/chatbot/changeBranding",[Auth], (req, res) => {
  return chatbot.changeBranding(req, res);
})

router.post("/chatbot/updateCustomDomain",[Auth], (req, res) => {
  return chatbot.updateCustomDomain(req, res);
})

router.post("/chatbot/getSignedUrl", [Auth],(req, res) => {
  return chatbot.getSignedUrl(req, res);
})
router.post("/chatbot/uploadLogo", [Auth],(req, res) => {
  return chatbot.uploadLogo(req, res);
})

// **********************ProjectText*******************

router.post("/createProjectText",[Auth], (req, res) => {
  return projectText.createProjectText(req, res);
})

router.post("/bulkCreateProjectText",[Auth], (req, res) => {
  return projectText.bulkCreateProjectText(req, res);
})

router.post("/updateProjectText",[Auth], (req, res) => {
  return projectText.updateProjectText(req, res);
})

router.post("/deleteProjectText",[Auth], (req, res) => {
  return projectText.deleteProjectText(req, res);
})

router.post("/getProjectText",[Auth], (req, res) => {
  return projectText.getProjectText(req, res);
})

router.post("/getYoutubeTranscript", [], (req, res) => {
  return projectText.getYoutubeTranscript(req, res)
})

router.post("/getImageText", [Auth], (req, res) => {
  return projectText.getImageText(req, res)
})
// **********************Session*******************


router.post("/refreshProjectKey", [APIAuth],(req, res) => {
  return project.refreshProjectKey(req, res);
});

router.post("/updateProjectSettings", [Auth],(req, res) => {
  return project.updateProjectSettings(req, res);
});


// ****************************Prompt*****************************

router.post("/getPrompt", [], (req, res) => {
  return prompt.getPrompt(req, res);
});


// subscription routes

router.post("/createSubscription", [Auth], (req, res) => {
  return Subscription.createSubscription(req, res);
})

router.post("/createPaddleSubscription", [Auth], (req, res) => {
  return Subscription.createPaddleSubscription(req, res);
})

router.post("/createEliteSubscription", [], (req, res) => {
  return Subscription.createEliteSubscription(req, res);
})

router.post("/cancelSubscription", [Auth], (req, res) => {
  return Subscription.cancelSubscription(req, res);
})

router.post("/subscriptionWebHook", [], (req, res) => {
  return Subscription.subscriptionWebHook(req, res);
})

router.post("/paddleSubscriptionWebHook", [], (req, res) => {
  return Subscription.paddleSubscriptionWebHook(req, res);
})

router.post("/getAllSubscription", [], (req, res) => {
  return Subscription.getAllSubscription(req, res);
})

router.post("/getSubscription", [Auth], (req, res) => {
  return Subscription.getSubscription(req, res);
})

router.post("/getActivePlanDetail", [Auth], (req, res) => {
  return Subscription.getActivePlanDetail(req, res);
})

router.post("/getActivePlan", [Auth], (req, res) => {
  return Subscription.getActivePlan(req, res);
})

router.post("/updateSubscription", [Auth], (req, res) => {
  return Subscription.updateSubscription(req, res);
})

router.post("/getTrailEndUser", [], (req, res) => {
  return Subscription.getTrailEndUser(req, res);
})

router.post("/sendEmailTrailEndUser", [], (req, res) => {
  return Subscription.sendEmailTrailEndUser(req, res);
})

router.post("/manageBilling", [Auth], (req, res) => {
  return Subscription.manageBilling(req, res);
})

router.post("/addOnSubscription", [Auth], (req, res) => {
  return Subscription.addOnSubscription(req, res);
})

router.post("/changeSubscriptionAddOn", [Auth], (req, res) => {
  return Subscription.changeSubscriptionAddOn(req, res);
})

router.post("/removeSubscriptionAddOn", [Auth], (req, res) => {
  return Subscription.removeSubscriptionAddOn(req, res);
})

router.post("/getUnPaidInvoice", [Auth], (req, res) => {
  return Subscription.getUnPaidInvoice(req, res);
})

router.post("/undoSubscriptionUpgrade", [Auth], (req, res) => {
  return Subscription.undoSubscriptionUpgrade(req, res);
})

router.post("/updateTrialToActiveSubscription", [Auth], (req, res) => {
  return Subscription.updateTrialToActiveSubscription(req, res);
})

router.post("/getInvoiceByProjectId", [Auth], (req, res) => {
  return Invoice.getInvoiceByProjectId(req, res);
});

router.post("/getInvoiceByOrganization", [Auth], (req, res) => {
  return Invoice.getInvoiceByOrganization(req, res);
});

module.exports = router;