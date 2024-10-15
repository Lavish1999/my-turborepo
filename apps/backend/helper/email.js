const nodemailer = require('nodemailer')
const { User } = model('index.js')
let { loadEmailTemplate } = require(baseDir() + "helper/helper");
const sendEmailNotification = async (action , user_id , data) => {
    logInfo("sendEmailNotification",action , user_id , data);
    let valid
    switch (action) {
        case "send_email_on_trial_limit_reached":
            if(data.percentage>=100  && data.percentage>75){
                valid = await sendEmail({title : `🚧 Trail Limit Reached - Urgent Action Required 🚧`,user_id : user_id,data :data,emailTemplate :"sendEmailOnTrialLimitReached.ejs"})
            }else if(data.percentage<=75 && data.percentage>50){
                valid = await sendEmail({title : `🚨 ${data.percentage}% Trail Limit Reached - Action Required 🚨`,user_id : user_id,data :data,emailTemplate :"sendEmailOnTrialLimitReached.ejs"})
            }else{
                valid = await sendEmail({title : `⚠️ ${data.percentage}% Trail Limit Reached - Action Required ⚠️`,user_id : user_id,data :data,emailTemplate :"sendEmailOnTrialLimitReached.ejs"})
            }
            break;
        case "send_email_on_limit_reached":
            if(data.percentage<100){
                valid = await sendEmail({title : `⚠️ ${data.percentage}% usage limit reached - Action Required ⚠️`,user_id : user_id,data :data,emailTemplate :"sendEmailOnLimitReached.ejs"})
            }else{
                valid = await sendEmail({title : `🚧 Important: 100% Usage Limit Reached - Action Required 🚧`,user_id : user_id,data :data,emailTemplate :"sendEmailOnLimitReached.ejs"})
            }
            break;
        case "account_created":
            valid = await sendEmail({title : "Get started with YourGPT!",user_id : user_id,data :data,emailTemplate :"welcome.ejs"})
            break;
        // case "new_chatbot_created":
        //     logInfo("new_chatbot_created");
        //     valid = await sendEmail({title : "Your chatbot is setup!",user_id : user_id,data :data,emailTemplate :"newChatbot.ejs"})
        //     break;
        case "new_workspace_created":
            logInfo("new_workspace_created");
            valid = await sendEmail({title : "New workspace created",user_id : user_id,data :data,emailTemplate :"newWorkspace.ejs"})
            break;
        case "chatbot_trial_expired":
            logInfo("chatbot_trial_expired");
            valid = await sendEmail({title : "Your Chatbot trial expired",user_id : user_id,data :data,emailTemplate :"chatbotTrialExpired.ejs"})
            break;
        // case "qamaster_trial_expired":
        //     logInfo("qamaster_trial_expired");
        //     valid = await sendEmail({title : "Your QA Master trial expired",user_id : user_id,data :data,emailTemplate :"qaMasterTrialExpired.ejs"})
        //     break;
        // case "chatbot_trail_expiry_in_next_2days":
        //     logInfo("chatbot_trail_expiry_in_next_2days");
        //     valid = await sendEmail({title : "Your Chatbot trial expiry in 2 days",user_id : user_id,data :data,emailTemplate :"chatbotTrailExpiryInNext2Days.ejs"})
        //     break;
        // case "qamaster_trail_expiry_in_next_2days":
        //     logInfo("qamaster_trail_expiry_in_next_2days");
        //     valid = await sendEmail({title : "Your QA master trial expired in 2 days",user_id : user_id,data :data,emailTemplate :"qaMasterTrailExpiryInNext2Days.ejs"})
        //     break;
        // case "subscription_created":
        //     logInfo("subscription_created");
        //     valid = await sendEmail({title : "Subscriprion created",user_id : user_id,data :data,emailTemplate :"subscriptionCreated.ejs"})
        //     break;

        case "user_promocode":
            logInfo("Promocode sending");
            const maildata = config('mail')
            let transporter = nodemailer.createTransport(maildata);

            // send mail with defined transport object
            try {
                let htmlMessage = await loadEmailTemplate('promocode.ejs', {
                    data : data
                });
                let info = await transporter.sendMail({
                    from: '"YourGPT Team" <noreply@yourgpt.ai>"', // sender address,
                    to: user_id, // list of receivers
                    subject: data.title, // Subject line
                    html: htmlMessage, // plain text body
                });
                if (info.messageId) {
                    valid = true
                }
            }catch(error){
                valid = false
            }
            break;
        default:
            valid = true
            break;
    }
    logInfo(valid);
    return valid
}

const sendEmail = async (data) => {
    const user = await User.findOne({
        where : {
            id : data.user_id
        }
    })
    if (!user) {
        return false
    }
    data.data.user = user
    const maildata = config('mail')
    let transporter = nodemailer.createTransport(maildata);

    // send mail with defined transport object
    try {
        let htmlMessage = await loadEmailTemplate(data.emailTemplate, {
            data : data.data
        });
        let info = await transporter.sendMail({
            from: '"YourGPT Team" <noreply@yourgpt.ai>"', // sender address,
            to: user.email, // list of receivers
            subject: data.title, // Subject line
            html: htmlMessage, // plain text body
        });
        if (info.messageId) {
            return true
        }
        return false
    } catch (error) {
        logInfo(error);
        return false
    }

}

module.exports = {
    sendEmailNotification
}