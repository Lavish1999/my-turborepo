const { stripe_secret_key,default_tax_rates }=config('stripe');
const { paddle_api_key, environment }=config('paddle');
const stripe = require('stripe')(stripe_secret_key)
const crypto = require("crypto")
const moment = require('moment')
let { formatJoiError, ucfirst, isset, strlen, strpos, count, authUser, in_array, rand, validateParameters, getIpDetail,loadEmailTemplate,getProject,notifyOnDiscord,userPrivilege,getProjectData } = require(baseDir() + "helper/helper");
let { updateBrevoContact } = require(baseDir() + "helper/syncContactToBrevo");
let { sendEmailNotification } = require(baseDir() + "helper/email");
const { Op } = require('sequelize');
const { Paddle, Environment } = require("@paddle/paddle-node-sdk");
const paddle = new Paddle(paddle_api_key, { environment: Environment[environment] });
const Sequelize = require('sequelize');
const { Subscription,Invoice,Transaction,Discount, Organization, DiscountSubscription,sequelize,UsageLimit,Project,UsageData,OrganizationMember,InvoiceLineItem,User,Setting,ProductTrial,BrevoContact,EmailNotificationsListUser,ChatbotIntegrationsSetting } = require("../../../../Models");
const { create } = require('@hapi/joi/lib/ref');
const nodemailer = require('nodemailer')
const QueryTypes = Sequelize.QueryTypes;
let Joi = require("@hapi/joi");
module.exports = class SubscriptionController {

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * 
     * create subsription by using payment url getting from checkout session 
     */
    
    async createSubscription(req, res) {

        const input = req.body
        let user_id = req.authUser.user_id;
        let email = req.authUser.User.email;
  
        // validate the params
        let result = validateParameters(["id","plan","app_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }
        logInfo("Input logs",input)
        // if (input?.is_trial == "true") {
        //     input.is_trial = "true"
        // }else{
        //     input.is_trial = "false"
        // }
        let ip_address = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        
        let ip_detail = await getIpDetail(ip_address)
        let currency;
        let country;
        if(typeof ip_detail === 'undefined' || ip_detail === null){
          country = 'US'
        } else {
          country = ip_detail.country
        } 

        let app_plans = {...config('plan')};
        let plans = app_plans.plans[input.app_id];

        if(plans==null || typeof plans=='undefined'){
            return res.status(400).send({type:"RXERROR",message:"Invalid plan or app_id"})
        }
        
        if (!plans[`${input.plan}`]) {
            return res.status(400).send({
                type: "RXERROR",
                message: "The plan must be one of the existing plans."
            });
        }
        let plan = JSON.parse(JSON.stringify(plans[`${input.plan}`]))

        let gateway_plan_id
        let  { default_tax_rates }=config('stripe')
        if (input.app_id <=2) {
            if(country=='IN'){
                currency = 'INR';
                gateway_plan_id = plan.inr_stripe_plan_id

            }else{
                currency = 'USD',
                gateway_plan_id = plan.stripe_plan_id
            }
        }else{
            currency = undefined
            gateway_plan_id = plan.stripe_plan_id
        }
        if (country!='IN') {
            default_tax_rates = []
        }
        
    
        try {

            let project_id
            let organization_id
            switch (plan.type) {
                case "organization":
                    const organization = await OrganizationMember.findOne({
                        where : {
                            organization_id : input.id,
                            user_id : user_id,
                            role : "owner"
                        }
                    })
                    if(!organization){
                        return res.status(400).send({type:"RXERROR",message:"Invalid organization_id"})
                    }
                    organization_id = input.id
                    project_id = null
                    break;
                case "project":
                    let data = await Project.findOne({
                        where : {
                            project_uid : input.id
                        }
                    })
                    if (!data) {
                        return res.status(400).send({type:"RXERROR",message:"Invalid project_uid"})
                    }
                    project_id = data.id,
                    organization_id = data.organization_id

                    break;
            
                default:
                    break;
            }

            if (plan.isFree) {
                const data = await UsageData.findAll({
                    where : {
                        app_id : input.app_id,
                        project_id : project_id,
                        organization_id : organization_id,
                    }
                })
                logInfo(data.length > 0);
                if (data.length > 0) {
                    if (data[0].plan_id == "1" || data[0].plan_id == "16") {
                        return res.status(400).send({
                            type:"RXERROR",
                            message:"You have a free plan exists"
                        })
                    }
                    return res.status(400).send({
                        type:"RXERROR",
                        message:"You have a paid plan exists"
                    })
                }
                const plan_benefits = JSON.stringify(plan)
                await usageDatabyAppId(input.app_id,project_id,organization_id,plan_benefits)
                await usageLimitbyAppId(input.app_id,project_id,organization_id,plan_benefits)
                const searchBy = req.authUser.User.email
                const updateBrevoContactData = await updateBrevoContact({chatbot_plan:`${input.plan}`},searchBy)
                return res.status(200).send({
                    type:"RXSUCCESS",
                    message:"free plan added successfully",
                    data : null
                })
            }

            if (plan?.is_trial) {
                const PlanData = await ProductTrial.findOne({
                    where : {
                        app_id : input.app_id,
                        organization_id : organization_id,
                        user_id : user_id,
                        project_id : project_id
                    }
                })
                if (PlanData) {
                    return res.status(400).send({
                        type:"RXERROR",
                        message:"You have already utilized the free trial. To continue using our services, kindly consider purchasing a paid plan."
                    })
                }
                const expiry_date = moment().add(7,"days").format("YYYY-MM-DD HH:mm:ss");
                const userPlan = await ProductTrial.create({
                    app_id : input.app_id,
                    organization_id : organization_id,
                    user_id : user_id,
                    project_id : project_id,
                    plan_id : plan.plan_id,
                    expiry_date : expiry_date,
                    status : "free_trial"
                })
                const plan_benefits = JSON.stringify(plan)
                await usageDatabyAppId(input.app_id,project_id,organization_id,plan_benefits)
                await usageLimitbyAppId(input.app_id,project_id,organization_id,plan_benefits)
                const searchBy = req.authUser.User.email
                const brevo_expiry_date = moment().utc(true).add(7,"days").format("YYYY-MM-DD");
                let updatedData = {}
                switch (input.app_id) {
                    case "1":
                        updatedData = {chatbot_plan:`${input.plan}`,CHATBOT_TRAIL_EXPIRY : brevo_expiry_date , CHATBOT_TRAIL_STATUS : "InTrail"}
                        break;
                    case "2":
                        updatedData = {chatbot_plan:`${input.plan}`,QAMASTER_TRAIL_EXPIRY : brevo_expiry_date,QAMASTER_TRAIL_STATUS : "InTrail"}
                        break;
                
                    default:
                        break;
                }
                await updateBrevoContact(updatedData,searchBy)
                return res.status(200).send({
                    type:"RXSUCCESS",
                    message:"Congratulations! You have successfully purchased a trial plan. Enjoy exploring the benefits and features it offers.",
                    data : userPlan
                })
            }
            // return res.status(400).send({
            //     type:"RXERROR",
            //     message:"The plan you entered does not include a trail plan."
            // })

            // if (input.is_trial === "true") {
            // }

            const user = await Subscription.findOne({
                where : {
                    user_id : user_id,
                    collection_method : {
                        [Op.notIn] : ["manual","paddle"]
                    }
                },
                order : [['id','DESC']]
            })
    
            let customer
            let newCustomer
            if (user) {
                if (user.organization_id == organization_id && user.app_id == input.app_id) {
                    if (user.status == "active") {
                        return res.status(400).send({
                            type:"RXERROR",
                            message:"You've already subscribed, but you have the option to upgrade",
                        }) 
                    } else if (user.status == "trialing") {
                        return res.status(400).send({
                            type:"RXERROR",
                            message:"You've already subscribed have a trial plan.",
                        }) 
                    }
                }
                customer = user.customer_id,
                newCustomer = false
            }
            else{
                customer = [],
                newCustomer = true
            }

            const successUrl = await paymentRedirectionUrl("success",plan,{})
            const cancelUrl = await paymentRedirectionUrl("cancel",plan,{})
            plan.successUrl = undefined
            plan.cancelUrl = undefined
            plan.app_id = input.app_id
            let add_on_item = [] , plan_error = {value : false} 
            let add_on_data = []
            if (input?.add_on) {
                let add_on
                let valid_array = await validateArray(input?.add_on)
                if (!valid_array.valid) {
                    return res.status(400).send({
                        type : "RXERROR",
                        message : valid_array.error.message
                    })
                }
                if (input.is_subscription_trial) {
                    return res.status(400).send({
                        type:"RXERROR",
                        message:"You can't purchase add-on plan with trial plan.",
                    })
                }
                switch (input.app_id) {
                    case "1":
                        add_on =  "chat_bot_add_on"
                        break;
                    case "2":
                        add_on =  "qa_add_on"
                        break;
                
                    default:
                        break;
                }
                let add_on_price_id , add_on_quantity , recurring_interval = plan.recurring_interval
                for (let i = 0; i < input.add_on.length; i++) {
                    let item = input.add_on[i];

                    add_on_quantity = item.quantity
                    let add_on_plan = plans[`${add_on}`][`${item.add_on_plan_name}`]
                    if (!add_on_plan) {
                        plan_error = {
                            value : true,
                            message : `${item.add_on_plan_name} does't exists`
                        }
                        break;
                    }
                    let unique_plan = input?.add_on.find((plan_item , j) => {
                        if (i!=j) {
                            return plan_item.add_on_plan_name == item.add_on_plan_name
                        }
                    })
                    if (unique_plan) {
                        plan_error = {
                            value : true,
                            message : `${item.add_on_plan_name} should be unique`
                        }
                        break;
                    }
                    // recurring_interval = add_on_plan.recurring_interval
                    // if (recurring_interval == null) {
                    //     recurring_interval = add_on_plan.recurring_interval
                    // }
                    if(recurring_interval != add_on_plan.recurring_interval){
                        plan_error = {
                            value : true,
                            message : `The plan ${input.plan} and ${item.add_on_plan_name} should have the same recurring interval, monthly or yearly`
                        }
                        break;
                    }
                    if (add_on_plan.max_limit < add_on_quantity) {
                        plan_error = {
                            value : true,
                            message : `You've hit the maximum limit for purchasing quantity.`
                        }
                        break;
                    }
                    // if (add_on_plan.use_for == "agency" && plan.use_for != "agency") {
                    //     plan_error = {
                    //         value : true,
                    //         message : `You can't purchase this plan for agency.`
                    //     }
                    //     break;
                        
                    // }
                    let purpose = add_on_plan.purpose
                    
                    if (country == 'IN') {
                        add_on_price_id = add_on_plan.inr_stripe_plan_id
                    }
                    else {
                        add_on_price_id = add_on_plan.stripe_plan_id
                    }
    
                    // Object.keys(plan).forEach((key) => {
                    //     if (plan.features.includes(key)) {
                        // purpose.forEach((purpose_item) => {
                        //     if (typeof plan[purpose_item] != "undefined") {
                        //         plan[purpose_item] = plan[purpose_item] + add_on_plan[purpose_item] * item.quantity
                        //     }
                        // })
                        for (let k = 0; k < purpose.length; k++) {
                            const purpose_item = purpose[k];
                            if (typeof plan[purpose_item] != "undefined") {
                                const regex = /^(\d+)\/∞$/;
                                if (regex.test(plan[purpose_item])) {
                                    plan[purpose_item] = `${Number(plan[purpose_item].split('/')[0]) + add_on_plan[purpose_item] * item.quantity}` + "/" + "∞"
                                }else if(plan[purpose_item] == "∞"){
                                    plan[purpose_item] = plan[purpose_item]
                                }else{
                                    plan[purpose_item] = plan[purpose_item] + add_on_plan[purpose_item] * item.quantity
                                }
                            }
                        }
                    //     }
                    // })
                    add_on_data.push({name:item.add_on_plan_name, quantity : item.quantity})
                    // plan.add_on = add_on_data
                    add_on_item.push({
                        price : add_on_price_id,
                        quantity : add_on_quantity
                    })                    
                }
            }
            if (plan_error.value) {
                return res.status(400).send({
                    type : "RXERROR",
                    message:plan_error.message
                })
            }

            plan.stripe_plan_id = undefined
            plan.inr_stripe_plan_id = undefined
            let trial_data = {}
            if (input?.is_subscription_trial) {
                if (!plan?.is_subscription_trial) {
                    return res.status(400).send({
                        type : "RXERROR",
                        message : "The plan you entered does not include a trail plan."
                    })
                }
                trial_data = {
                    trial_settings: {
                        end_behavior: {
                            missing_payment_method: 'create_invoice',
                        },
                    },
                    trial_period_days: 3,
                }
                
            }
            const session = await stripe.checkout.sessions.create({
                success_url : successUrl,
                cancel_url  : cancelUrl,
                customer    : customer,
                line_items: [
                  { 
                    price: gateway_plan_id, 
                    quantity: 1,
                  },
                  ...add_on_item
                ],
                mode: 'subscription',
                metadata: {
                    'user_id': user_id,
                    'project_id': project_id,
                    'organization_id':organization_id,
                    'plan_id': plan.plan_id,
                    'app_id':input.app_id,
                    'plan_name':input.plan,
                    'subscription_benefits':JSON.stringify(plan),
                    "add_on" : add_on_data && add_on_data.length > 0 ? JSON.stringify(add_on_data) : '' ,
                    'email':email,
                    'newCustomer':newCustomer
                  },
                allow_promotion_codes : true,
                currency: currency,
                subscription_data: {
                    ...trial_data,
                    default_tax_rates: default_tax_rates,
                    metadata: {
                      'user_id': user_id,
                      'project_id': project_id,
                      'organization_id':organization_id,
                      'plan_id': plan.plan_id,
                      'app_id':input.app_id,
                      'plan_name':input.plan,
                      'subscription_benefits':JSON.stringify(plan),
                      "add_on" : add_on_data && add_on_data.length > 0 ? JSON.stringify(add_on_data) : '' ,
                      'email':email,
                      'newCustomer':newCustomer,
                      'tolt_referral': req.body.referral
                    }
                  },
              });
            return res.status(200).send({type:"RXSUCCESS",message:"Payment session",data:session})

        } catch (error) {
            logInfo(error);
            return res.status(400).send({type:"RXERROR",message:"Something went wrong"})
        }
    }

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * 
     * create subsription for paddle 
     */
    
    async createPaddleSubscription(req, res) {

        const input = req.body
        let user_id = req.authUser.user_id;
        let email = req.authUser.User.email;
  
        // validate the params
        let result = validateParameters(["id","plan","app_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }
        logInfo("Input logs",input)

        let app_plans = {...config('plan')};
        let plans = app_plans.plans[input.app_id];

        if(plans==null || typeof plans=='undefined'){
            return res.status(400).send({type:"RXERROR",message:"Invalid plan or app_id"})
        }
        
        if (!plans[`${input.plan}`]) {
            return res.status(400).send({
                type: "RXERROR",
                message: "The plan must be one of the existing plans."
            });
        }
        let plan = JSON.parse(JSON.stringify(plans[`${input.plan}`]));
        if(!plan?.paddle_plan_id){
            return res.status(400).send({
                type: "RXERROR",
                message: "Paddle priceId not available for this plan."
            });
        }

        let paddle_plan_id = plan.paddle_plan_id;
    
        try {

            let project_id
            let organization_id
            switch (plan.type) {
                case "organization":
                    const organization = await OrganizationMember.findOne({
                        where : {
                            organization_id : input.id,
                            user_id : user_id,
                            role : "owner"
                        }
                    })
                    if(!organization){
                        return res.status(400).send({type:"RXERROR",message:"Invalid organization_id"})
                    }
                    organization_id = input.id
                    project_id = null
                    break;
                case "project":
                    let data = await Project.findOne({
                        where : {
                            project_uid : input.id
                        }
                    })
                    if (!data) {
                        return res.status(400).send({type:"RXERROR",message:"Invalid project_uid"})
                    }
                    project_id = data.id,
                    organization_id = data.organization_id

                    break;
            
                default:
                    break;
            }

            const subscription = await Subscription.findOne({
                where : {
                    user_id : user_id,
                    collection_method : {
                        [Op.ne] : "manual"
                    }
                },
                order : [['id','DESC']]
            })
    
            if (subscription) {
                if (subscription.status == "active" && subscription.organization_id == organization_id && subscription.app_id == input.app_id) {
                    return res.status(400).send({
                        type:"RXERROR",
                        message:"You've already subscribed, but you have the option to upgrade",
                    }) 
                }
            }

            plan.successUrl = undefined
            plan.cancelUrl = undefined
            plan.app_id = input.app_id
            let add_on_item = [] , plan_error = {value : false} 
            let add_on_data = []
            if (input?.add_on) {
                let add_on
                let valid_array = await validateArray(input?.add_on)
                if (!valid_array.valid) {
                    return res.status(400).send({
                        type : "RXERROR",
                        message : valid_array.error.message
                    })
                }
                switch (input.app_id) {
                    case "1":
                        add_on =  "chat_bot_add_on"
                        break;
                    case "2":
                        add_on =  "qa_add_on"
                        break;
                
                    default:
                        break;
                }
                let add_on_price_id , add_on_quantity , recurring_interval = plan.recurring_interval
                for (let i = 0; i < input.add_on.length; i++) {
                    let item = input.add_on[i];

                    add_on_quantity = Number(item.quantity)
                    let add_on_plan = plans[`${add_on}`][`${item.add_on_plan_name}`]
                    if (!add_on_plan) {
                        plan_error = {
                            value : true,
                            message : `${item.add_on_plan_name} does't exists`
                        }
                        break;
                    }
                    let unique_plan = input?.add_on.find((plan_item , j) => {
                        if (i!=j) {
                            return plan_item.add_on_plan_name == item.add_on_plan_name
                        }
                    })
                    if (unique_plan) {
                        plan_error = {
                            value : true,
                            message : `${item.add_on_plan_name} should be unique`
                        }
                        break;
                    }

                    if(recurring_interval != add_on_plan.recurring_interval){
                        plan_error = {
                            value : true,
                            message : `The plan ${input.plan} and ${item.add_on_plan_name} should have the same recurring interval, monthly or yearly`
                        }
                        break;
                    }
                    if (add_on_plan.max_limit < add_on_quantity) {
                        plan_error = {
                            value : true,
                            message : `You've hit the maximum limit for purchasing quantity.`
                        }
                        break;
                    }
                    
                    add_on_price_id = add_on_plan?.paddle_plan_id;
                    if(add_on_price_id){
                        add_on_data.push({name:item.add_on_plan_name, quantity : add_on_quantity})
                        add_on_item.push({
                            priceId : add_on_price_id,
                            quantity : add_on_quantity
                        })
                    }                   
                }
            }
            if (plan_error.value) {
                return res.status(400).send({
                    type : "RXERROR",
                    message:plan_error.message
                })
            }

            plan.stripe_plan_id = undefined
            plan.inr_stripe_plan_id = undefined
            let custom_data = {
                user_id: user_id,
                organization_id: organization_id,
                app_id: input.app_id,
                plan_name: input.plan
            };
            if(add_on_data && add_on_data.length > 0) custom_data.add_on = JSON.stringify(add_on_data);
            let data = {
                items: [
                  { 
                    priceId: paddle_plan_id, 
                    quantity: 1,
                  },
                  ...add_on_item
                ],
                customData: custom_data,
            }
            return res.status(200).send({type:"RXSUCCESS",message:"Payment session",data:data})

        } catch (error) {
            logInfo(error);
            return res.status(400).send({type:"RXERROR",message:"Something went wrong"})
        }
    }

    async getAllSubscription(req, res) {

        try {

            // const subscription = await stripe.invoices.retrieve(
            //     'in_1OadWVSFnJmyrDL83sVRK9Gf'
            //   );
            
            // const subscription = await stripe.invoices.voidInvoice(
            //     'in_1NhtwRSFnJmyrDL8kJAYuWxX'
            //   );
            const subscription = await stripe.invoices.retrieveUpcoming({
                customer: 'cus_PqPbvanrungYOQ',
                subscription : 'sub_1P0im0SFnJmyrDL8YH58e92s'
            });

            // const subscription = await stripe.checkout.sessions.create({
            // success_url: 'https://example.com/success',
            // line_items: [
            //     {price: 'price_1Nq9jYSFnJmyrDL8mgVYo6pZ', quantity: 1},
            // ],
            // mode: 'subscription',
            // });
            // const subscription = await stripe.invoices.pay(
            //     'in_1NhrbwSFnJmyrDL8shAlf4hc'
            //   );
            // const subscription = await stripe.products.create({
            //     name: 'Elite Special',
            //     tax_code :'txr_1NngkmSFnJmyrDL8dKqA9XRK'
            // });
            // const subscription = await stripe.subscriptions.retrieve(
            //     'sub_1OaFrISFnJmyrDL88dKIoP4p'
            //   );
            // const subscription = await stripe.charges.retrieve(
            //     'ch_3MrhTbSFnJmyrDL81XDTMA7g'
            //   );
            // const subscription = await stripe.plans.create({
            //     amount: 100,
            //     currency: 'INR',
            //     interval: 'month',
            //     product: 'prod_Ne02VyrsXPZNuy',
            //   });
            // const proration_date = Math.floor(Date.now() / 1000);

            // const subscription = await stripe.subscriptions.update(
            //     'sub_1NlBAxSFnJmyrDL8r0gZC98G',
            //     {
            //         items : [
            //             {
            //                 price : "price_1Nq9jYSFnJmyrDL8mgVYo6pZ",
            //                 quantity : 1,
            //             }
            //         ],
            //         // proration_behavior: "create_prorations",
            //         // proration_date : proration_date
            //     }
            // );
            // const subscription = await stripe.paymentIntents.retrieve(
            //     'pi_3Nhos1SFnJmyrDL818iYLTuE'
            //   );
            // const subscription = await stripe
            // .confirmCardPayment('pi_3Nhos1SFnJmyrDL818iYLTuE_secret_HzDjGSgL7O3TwxZE56shpRowl', {
            //     // payment_method: {
            //     // card: cardElement,
            //     // billing_details: {
            //     //     name: 'Jenny Rosen',
            //     // },
            //     // },
            //     })
            // Set your secret key. Remember to switch to your live secret key in production.


            // const subscription = await stripe.billingPortal.sessions.create({
            // customer: 'cus_NnkWy5whQMMAs6',
            // return_url: 'https://example.com/account',
            // });
            // const subscription = await stripe.subscriptions.cancel('sub_1OJjaw2eZvKYlo2C3zjU4rGQ');
                
                res.send(subscription)
        } catch (error) {
            logInfo(error);
        }
        
    
    }

    async createEliteSubscription(req, res) {
        const input = req.body
        
        // validate the params
        let result = validateParameters(["plan","app_id","id","price","user_id","chatbot","webpages","document","queries"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }
        let user_id = input.user_id;
        let app_plans = {...config('plan')};
        let plans = app_plans.plans[input.app_id];
        const plan = plans[`${input.plan}`]
        if (!plan) {
            return res.status(400).send({
                type: "RXERROR",
                message: "plan must be chatbot_basic_monthly,chatbot_starter_monthly,chatbot_growth_monthly,chatbot_professional_monthly"
            });
        }

        plan["chatbot"] = input.chatbot
        plan["webpages"] = input.webpages
        plan["document"] = input.document
        plan["queries"] = input.queries

        let project_id
        let organization_id
        switch (plan.type) {
            case "organization":
                const organization = await OrganizationMember.findOne({
                    where : {
                        organization_id : input.id,
                        user_id : user_id,
                        role : "owner"
                    }
                })
                if(!organization){
                    return res.status(400).send({type:"RXERROR",message:"Invalid organization_id"})
                }
                organization_id = input.id
                project_id = null
                break;
            case "project":
                let data = await Project.findOne({
                    where : {
                        project_uid : input.id
                    }
                })
                if (!data) {
                    return res.status(400).send({type:"RXERROR",message:"Invalid project_uid"})
                }
                project_id = data.id,
                organization_id = data.organization_id

                break;
        
            default:
                break;
        }

        const user = await Subscription.findOne({
            where : {
                user_id : user_id,
            },
            order : [['id','DESC']]
        })

        let customer
        if (user) {
            if (user.status == "active" && user.organization_id == organization_id && user.app_id == input.app_id) {
                return res.status(400).send({
                    type:"RXERROR",
                    message:"You've already subscribed, but you have the option to upgrade",
                }) 
            }
            customer = user.customer_id
        }
        else{
            customer = []
        }

        let price = await stripe.prices.create({
            unit_amount: input.price,
            currency: 'usd',
            recurring: {interval: 'month'},
            product: 'prod_NpwsKH7QwZHxOB',
        });

        const gateway_plan_id = price.id

        const successUrl = await paymentRedirectionUrl("success",plan,{})
        const cancelUrl = await paymentRedirectionUrl("cancel",plan,{})

        const session = await stripe.checkout.sessions.create({
            success_url: successUrl,
            cancel_url: cancelUrl,
            // customer : customer,
            line_items: [
                { price: gateway_plan_id, quantity: 1 },
            ],
            mode: 'subscription',
            metadata: {
                'user_id': user_id,
                'project_id': project_id,
                'organization_id':organization_id,
                'plan_id': plan.plan_id,
                'app_id':input.app_id,
                'plan_name':input.plan,
                'subscription_benefits':JSON.stringify(plan)
                },
            allow_promotion_codes : true,
            subscription_data: {
                metadata: {
                    'user_id': user_id,
                    'project_id': project_id,
                    'organization_id':organization_id,
                    'plan_id': plan.plan_id,
                    'app_id':input.app_id,
                    'plan_name':input.plan,
                    'subscription_benefits':JSON.stringify(plan)
                }
                },
            });
        return res.status(200).send({type:"RXSUCCESS",message:"Payment session",data:session})
        
    }

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * @returns 
     * 
     * cancel subscription 
     */
    async cancelSubscription(req, res) {

        const input = req.body
        let user_id = req.authUser.User.id

        let result = validateParameters(["subscription_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
                type: "RXERROR",
                message: "Invalid params",
                errors: error
            });
        }

        const data = await Subscription.findOne({
            where : {
                id : input.subscription_id,
                user_id:user_id,
                status : {
                    [Op.ne]: 'canceled'
                }
            }
        })

        if(!data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "No Subscription found or invalid subscription_id for this user",
            });
        }

        const subscription_id = data.subscription_id;
        let type = data.collection_method;

        try {
            let deleted = null;

            switch(type){
                case "paddle" :
                deleted = await paddle.subscriptions.cancel(subscription_id, { effectiveFrom: "next_billing_period" });
                await Subscription.update({ canceled_at: getUnixTime(new Date()) }, { where : { id: data.id } })
                    break;

                default :
                deleted = await stripe.subscriptions.update(subscription_id, { cancel_at_period_end: true });
                    break;
            };
            const str = `Subscirpion cancelation \`\`\`user_id =${data.user_id} , organization_id=${data.organization_id}, reason = ${input?.description}\`\`\``
            await notifyOnDiscord(str)
            return res.status(200).send({
                type : "RXSUCCESS",
                message:"Subscription cancel successfully",
                data : deleted
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong",
            });
        }
        
    }

    async getSubscription(req, res) {
        const input = req.body
        let user_id = req.authUser.User.id

        let result = validateParameters(["project_uid"], input);
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        const project = await getProjectData(input.project_uid)
        if (!project) {
        return res.status(400).send({
            type : "RXERROR",
            message :"Invalid input project_uid"
        })
        }
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: project.id }, allowedRole: ['owner', 'editor', 'viewer'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }

          const data = await Subscription.findOne({
            where : {
                project_id : project.data.id,
                user_id : user_id
            },
            order : [['created_at','DESC']]
          })

          if (!data) {
            return res.status(400).send({
                type : "RXERROR",
                message :"data not found"
            })
          }

          return res.status(200).send({
            type : "RXSUCCESS",
            message :"data fatch successfully",
            data : data
        })
    };

    async updateSubscription(req, res) {
        const input = req.body
        let user_id = req.authUser.user_id;
        
        // validate the params
        let result = validateParameters(["plan","app_id","id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        try {

        let app_plans = {...config('plan')};
        let plans = app_plans.plans[input.app_id];

        if(plans==null || typeof plans=='undefined'){
            return res.status(400).send({type:"RXERROR",message:"Invalid plan or app_id"})
        }
        const plan = {...plans[`${input.plan}`]}
        if (!plan?.type) {
            return res.status(400).send({type:"RXERROR",message:"please enter correct plan and app_id match"})
        }

        let project_id
            let organization_id
            switch (plan.type) {
                case "organization":
                    const organization = await OrganizationMember.findOne({
                        where : {
                            organization_id : input.id,
                            user_id : user_id,
                            role : "owner"
                        }
                    })
                    // if(!organization){
                    //     return res.status(400).send({type:"RXERROR",message:"Invalid organization_id"})
                    // }
                    organization_id = input.id
                    project_id = null
                    break;
                case "project":
                    let data = await Project.findOne({
                        where : {
                            project_uid : input.id
                        }
                    })
                    if (!data) {
                        return res.status(400).send({type:"RXERROR",message:"Invalid project_uid"})
                    }
                    project_id = data.id,
                    organization_id = data.organization_id

                    break;
            
                default:
                    break;
            }

        const subscriptionData = await Subscription.findOne({
            include : [
                {
                    model : Invoice,
                    required : false,
                    where : {
                        status : 'open',
                        billing_reason : 'subscription_update',
                    },
                    order : [['id','desc']]
                }
            ],
            where :{
                app_id : input.app_id,
                project_id : project_id,
                organization_id : organization_id,
                user_id : user_id,
                status : {
                    [Op.in]:['active','past_due',"trialing"]
                }
            },
            order : [['id','desc']]
        });

        if (!subscriptionData) {
            return res.status(400).send({
                type: "RXERROR",
                message: "subscription_id may not exists or canceled"
            });
        };

        const subscription_plan = subscriptionData.plan_name
        const recurring_interval = plans[subscription_plan].recurring_interval
        if (plan.recurring_interval == 'monthly' && recurring_interval=='yearly') {
            return res.status(400).send({
                type: "RXERROR",
                message: "You cann't change a yearly subscription to monthly"
            });
        };
        if (subscriptionData.status == "trialing" && !plan.is_subscription_trial) {
            return res.status(400).send({
                type: "RXERROR",
                message: "This plan does not include a trial plan"
            });            
        }

        const check_limit = await UsageData.findAll({
            where :{
                app_id : input.app_id,
                project_id : project_id,
                organization_id : organization_id
            }
        });

        let limit_reached = await check_limit.find((data) => {
            let plan_value=plan[data.usage_type]
            if (typeof plan_value == "undefined") {
                return false
            }
            if(plan_value.toString().split("/").length>1){
                plan_value=parseInt(plan_value.toString().split("/")[0])
            }else if(plan_value=="∞"){
                return false
            }
            logInfo(data.usage_value, plan_value, data.usage_value > plan_value)
            return  data.usage_value > plan_value
        })
    
        logInfo(limit_reached);
        if (limit_reached) {
            return res.status(400).send({
                type : "RXERROR",
                message : `You exceed the ${limit_reached.usage_type} limit. Please contact support`
            })
        }
        // dd(limit_reached, plan)
        let purpose = null;
        let plan_app_id = null;
        let app_add_on = null;
        let subscription_benefits = null;
        let add_ons = null;
        let subscription = null;
        let data = null;
        let price_id = null;
        let items = [];
        let updated_data = null;
        let invoice_url = null;
        let result = null;

        plan_app_id = Number(input.app_id)
        app_add_on
        switch (plan_app_id) {
            case 1:
                app_add_on =  "chat_bot_add_on"
                break;
            case 2:
                app_add_on =  "qa_add_on"
                break;
        
            default:
                break;
        }
        subscription_benefits = JSON.parse(subscriptionData.subscription_benefits);
        add_ons = subscription_benefits.add_on
        delete subscription_benefits.add_on
        if (add_ons) {
            for (let j = 0; j < add_ons.length; j++) {
                const add_on = add_ons[j];
                logInfo(plans[app_add_on]);
                let add_on_plan = plans[app_add_on][add_on.name];
                purpose = add_on_plan.purpose
                for (let k = 0; k < purpose.length; k++) {
                    const purpose_item = purpose[k];
                    if (typeof plan[purpose_item] != "undefined") {
                        const regex = /^(\d+)\/∞$/;
                        if (regex.test(plan[purpose_item])) {
                            plan[purpose_item] = `${Number(plan[purpose_item].split('/')[0]) + add_on_plan[purpose_item] * add_on.quantity}` + "/" + "∞"
                        }else if(plan[purpose_item] == "∞"){
                            plan[purpose_item] = plan[purpose_item]
                        }else{
                            plan[purpose_item] = plan[purpose_item] + add_on_plan[purpose_item] * add_on.quantity
                        }
                    }
                }
            };
        };
        
        switch(subscriptionData.collection_method){
            case "paddle" :

            let paddle_plan_id = plan.paddle_plan_id;

            subscription = await paddle.subscriptions.get(subscriptionData.subscription_id);
            data = subscription.items;
            price_id = subscriptionData.gateway_plan_id;

            plan.stripe_plan_id = undefined
            plan.inr_stripe_plan_id = undefined
            plan.successUrl = undefined
            plan.cancelUrl = undefined
            
            data.map((item) => {
                if (item.price.id == price_id) {
                    items.push({ price_id: paddle_plan_id, quantity: 1 })
                } else items.push({ price_id : item.price.id });
            });

            updated_data = {
                items: items,
                customData: {
                    "user_id": user_id,
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "app_id": input.app_id,
                    "plan_id": plan.plan_id,
                    "plan_name" : input.plan,
                    "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : undefined ,
                    "subscription_benefits": JSON.stringify(plan),
                },
                prorationBillingMode: "prorated_immediately"
            };

            result = await paddle.subscriptions.update(subscriptionData.subscription_id, updated_data);

            if (subscriptionData.project_id && subscriptionData.organization_id) {
                project_id = subscriptionData.project_id,
                organization_id = subscriptionData.organization_id
            }
            if (!subscriptionData.project_id) {
                organization_id = subscriptionData.organization_id,
                project_id = null
            }
            invoice_url = null
            if (result.status == "active") {
                logInfo("++++++++++++++++++++++++++++");
                await updateUsageLimitbyAppId(input.app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(result.customData.subscription_benefits), add_on: result.customData?.add_on ? JSON.parse(result.customData.add_on) : undefined}))
                await upgradeUsageDatabyAppId(input.app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(result.customData.subscription_benefits), add_on: result.customData?.add_on ? JSON.parse(result.customData.add_on) : undefined}))
            }else if (result.status == "past_due") {
                let transaction_id = Transaction.findOne({ where: {subscription_id : subscriptionData.id}, order: [['created_at', 'DESC']]});
                let transaction = await paddle.transactions.getInvoicePDF(transaction_id);
                invoice_url = transaction.data.url;
            }
                break;
                
            default :
            if (subscriptionData.status == "past_due") {
                let invoice_id = subscriptionData.Invoices[0].invoice_id
                await stripe.invoices.voidInvoice(
                    invoice_id
                  );
                await new Promise(async(resolve,reject)=>{
                    setTimeout(()=>{
                        logInfo("oh wait........................@@@@@@@@@@@@@@@@@@@@@")
                        resolve(true)
                    },10000)
                })
            }
            
    
            let ip_address = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
            
            let ip_detail = await getIpDetail(ip_address)
            let currency;
            let country;
            if(typeof ip_detail === 'undefined' || ip_detail === null){
              country = 'US'
            } else {
              country = ip_detail.country
            } 
    
            let gateway_plan_id
            if(country=='IN'){
                currency = 'INR';
                gateway_plan_id = plan.inr_stripe_plan_id
    
            }else{
                currency = 'USD',
                gateway_plan_id = plan.stripe_plan_id
            }
    
            const proration_date = subscriptionData.current_period_start;
            subscription = await stripe.subscriptions.retrieve(subscriptionData.subscription_id);
            data = subscription.items.data
            price_id = subscriptionData.gateway_plan_id
            plan.stripe_plan_id = undefined
            plan.inr_stripe_plan_id = undefined
            plan.successUrl = undefined
            plan.cancelUrl = undefined

            logInfo(plan);
            items = data.map((item) => {
                if (item.plan.id == price_id) {
                    return {
                        id: item.id,
                        price: gateway_plan_id,
                        metadata : {
                            'user_id': user_id,
                            'project_id': project_id,
                            'organization_id':organization_id,
                            'plan_id': plan.plan_id,
                            'app_id':input.app_id,
                            'plan_name':input.plan,
                            'subscription_benefits':JSON.stringify(plan),
                            "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : '' ,
                            'newCustomer':false,
                        }
                      }
                }
                // else{
                //     return { 
                //         id : item.id, 
                //         deleted : true
                //     }
                // }
            })
            updated_data = {
                proration_behavior: 'create_prorations',
                metadata : {
                    'user_id': user_id,
                    'project_id': project_id,
                    'organization_id':organization_id,
                    'plan_id': plan.plan_id,
                    'app_id':input.app_id,
                    'plan_name':input.plan,
                    'subscription_benefits':JSON.stringify(plan),
                    "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : '' ,
                    'newCustomer':false,
                },
                items: items,
                proration_date: proration_date
            }
            if (plan.recurring_interval == "yearly") {
                updated_data.billing_cycle_anchor = 'now'
            }
            logInfo("itemmmmmmmmmmmmmmmmmmmmmmmmmmmm",items);
    
                plan.app_id = input.app_id
                delete plan.successUrl
                delete plan.cancelUrl
                result = await stripe.subscriptions.update(subscription.id, updated_data);
    
                if (subscriptionData.project_id && subscriptionData.organization_id) {
                    project_id = subscriptionData.project_id,
                    organization_id = subscriptionData.organization_id
                }
                if (!subscriptionData.project_id) {
                    organization_id = subscriptionData.organization_id,
                    project_id = null
                }
                invoice_url = null
                if (result.status == "active" || result.status == "trialing") {
                    logInfo("++++++++++++++++++++++++++++");
                    await updateUsageLimitbyAppId(input.app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(result.metadata.subscription_benefits), add_on: result.metadata?.add_on ? JSON.parse(result.metadata.add_on) : undefined}))
                    await upgradeUsageDatabyAppId(input.app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(result.metadata.subscription_benefits), add_on: result.metadata?.add_on ? JSON.parse(result.metadata.add_on) : undefined}))
                }else if (result.status == "past_due") {
                    const invoice = await stripe.invoices.retrieve(
                        result.latest_invoice
                    );
                    invoice_url = invoice.hosted_invoice_url
                }
                //await updateUsageDatabyAppId(input.app_id,project_id,organization_id,result.metadata.subscription_benefits)
    
                // const invoiceData = await stripe.invoices.retrieveUpcoming({
                //     customer: subscriptionData.customer_id,
                // });
    
                // const data = await Invoice.create({
                //     amount_due: invoiceData.amount_due,
                //     amount_paid: invoiceData.amount_paid,
                //     amount_remaining : invoiceData.amount_remaining,
                //     created:invoiceData.created,
                //     currency:invoiceData.currency,
                //     customer_id:invoiceData.customer,
                //     customer_email:invoiceData.customer_email,
                //     customer_name:invoiceData.customer_name,
                //     subscription_id:invoiceData.subscription,
                //     status:invoiceData.status,
                //     total:invoiceData.total,
                //     subtotal:invoiceData.subtotal,
                // })
    
                // const line_items = invoiceData.lines.data
                // await createInvoiceLineItems(line_items,data.id)    
                break;    
        }
            return res.status(200).send({type:"RXSUCCESS",message:"Subscription Updated data",data:result , invoice_url : invoice_url})
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "something went wrong"
            });
        }
        
    }

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * @return 2 days records whose trail will expire.
     */

    async sendEmailTrailEndUser(req, res) {
        const input = req.body
        const type = "2_days"
        let days
        if (input.days) {
            days = input.days
        }else{
            days = 2
        }

        const now=moment()
        const day2add=moment().utc(true).add(2,"day").format("YYYY-MM-DD HH:mm:ss");

        let data = await ProductTrial.findAll({
            include : [
                {
                    model : User,
                    as:"user"
                },
                {
                    model : EmailNotificationsListUser,
                    where : {
                        type : {
                            [Op.eq] : [type]
                        },
                        app_id: { [Op.eq]:Sequelize.col('ProductTrial.app_id') },
                        organization_id: { [Op.eq]:Sequelize.col('ProductTrial.organization_id') },
                        user_id: { [Op.eq]:Sequelize.col('ProductTrial.user_id') }
                    },
                    required : false
                }
            ],
            where : {
                expiry_date : {
                    [Op.between]: [now,day2add]
                },
                status : "free_trial"
            }
        })

        data = data.filter((users) => {
            return users.EmailNotificationsListUsers.length == 0
        })

        if (data.length == 0) {
            return res.status(400).send({
                type : "RXERROR",
                message:"No record found"
            })
        }

        let title
        for(let z=0;z<data.length;z++){
           let users=data[z];
            let aap_id = users.app_id
            switch (aap_id) {
                case 1:
                    title = "chatbot_trail_expiry_in_next_2days"
                    break;
                case 2:
                    title = "qamaster_trail_expiry_in_next_2days"
                    break;
            
                default:
                    break;
            }
            let user_id = users.user_id
            let name = users.user.name
            let expired_at = users.expiry_date
            const valid = await sendEmailNotification(title,user_id,{name : name , expired_at : expired_at})
            logInfo(valid);
            if (valid) {
                await EmailNotificationsListUser.create({
                    user_id : user_id,
                    type : type,
                    app_id : users.app_id,
                    organization_id : users.organization_id
                })
            }
        }

        return res.status(200).send({
            type : "RXERROR",
            message:"Record fetch successfully",
            data : data
        })
    }

    async sendEmailOnTrialLimitReached() {
        let data

        data  = await sequelize.query(`SELECT u.name,om.user_id,ud.*,ul.*,ud.usage_value / ul.limit_value as which_one, sb.status
                                        FROM usage_data ud
                                        LEFT JOIN usage_limits ul ON ud.plan_id = ul.plan_id and ud.organization_id = ul.organization_id 
                                        LEFT JOIN subscriptions sb on sb.plan_id = ul.plan_id and sb.organization_id = ul.organization_id
                                        LEFT JOIN organization_members om on om.id = ul.organization_id
                                        LEFT JOIN users u on u.id = om.user_id
                                        WHERE ud.usage_type = 'credits' and ul.limit_type= 'credits' and sb.id is null and ud.app_id='1'
                                        AND  ud.created_at > DATE_ADD(NOW(), INTERVAL -1 MONTH) AND 
                                        (
                                       ((ud.usage_value / ul.limit_value) >= 0.5 AND  (ud.usage_value / ul.limit_value) < 0.75 AND NOT EXISTS (
                                            SELECT *
                                           FROM email_notifications_list_users enlu
                                           WHERE enlu.organization_id = ud.organization_id
                                           AND enlu.type = CONCAT('trial_reached_50_off_', ul.limit_value)
                                       ))
                                        OR 
                                        ((ud.usage_value / ul.limit_value) >= 0.75 AND  (ud.usage_value / ul.limit_value) < 1 AND NOT EXISTS (
                                            SELECT 1
                                            FROM email_notifications_list_users enlu
                                            WHERE  enlu.organization_id = ud.organization_id
                                            AND enlu.type = CONCAT('trial_reached_75_off_', ul.limit_value)
                                        ))
                                        OR ((ud.usage_value / ul.limit_value) >= 1 AND NOT EXISTS (
                                            SELECT 1
                                            FROM email_notifications_list_users enlu
                                            WHERE enlu.organization_id = ud.organization_id
                                            AND enlu.type = CONCAT('trial_reached_100_off_', ul.limit_value)
                                        )));`,
                {
                    replacements:data,
                    type: QueryTypes.SELECT
                })

        if (data.length == 0) {
            return {
                type : "RXERROR",
                message:"No record found"
            }
        }

        let title
        let type
        let percentage
        for(let i=0;i<data.length;i++) {
            let users=data[i]
            let aap_id = users.app_id
            switch (aap_id) {
                case 1:
                    title = "credits_trail_reached"
                    break;
                case 2:
                    title = "qamaster_trail_expiry_in_next_2days"
                    break;
            
                default:
                    break;
            }
            let which_one = users.which_one
            // logInfo(which_one)

            if (which_one>=1) {
                percentage=100
                type = "trial_reached_100_off_"+users.limit_value;
            }
            else if(which_one>=0.75 && which_one < 1){
                percentage=75
                type = "trial_reached_75_off_"+users.limit_value;
            }
            else if(which_one>=0.5 && which_one < 0.75){
                percentage=50
                type = "trial_reached_50_off_"+users.limit_value;
            }
            else{
                continue
            }            
            
            let user_id = users.user_id
            let name = users.name
            // let expired_at = users.expiry_date"
            const valid = await sendEmailNotification('send_email_on_trial_limit_reached', user_id,{percentage : percentage, aap_id:aap_id})
            // logInfo(valid);
            if (valid) {
                await EmailNotificationsListUser.create({
                    user_id : user_id,
                    type : type,
                    app_id : users.app_id,
                    organization_id:users.organization_id
                })
            }
        }

        return {
            type : "RXERROR",
            message:"Record fetch successfully",
            data : data
        }
    }

    async sendEmailOnLimitReached() {
        let data

        data  = await sequelize.query(`SELECT u.name,om.user_id,ud.*,ul.*,ud.usage_value / ul.limit_value as which_one, sb.status
                                        FROM usage_data ud
                                        LEFT JOIN usage_limits ul ON ud.plan_id = ul.plan_id and ud.organization_id = ul.organization_id 
                                        LEFT JOIN subscriptions sb on sb.plan_id = ul.plan_id and sb.organization_id = ul.organization_id
                                        LEFT JOIN organization_members om on om.id = ul.organization_id
                                        LEFT JOIN users u on u.id = om.user_id
                                        WHERE ud.usage_type = 'credits' and ul.limit_type= 'credits' and sb.status='active' and ud.app_id='1'
                                        AND
                                        (
--    									((ud.usage_value / ul.limit_value) >= 0.5 AND  (ud.usage_value / ul.limit_value) < 0.75 AND NOT EXISTS (
--                                             SELECT *
--                                             FROM email_notifications_list_users enlu
--                                             WHERE enlu.organization_id = ud.organization_id
--                                             AND enlu.type = CONCAT('reached_50_off_', ul.limit_value)
--                                             AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
--                                         ))
--                                         OR 
                                        ((ud.usage_value / ul.limit_value) >= 0.75 AND  (ud.usage_value / ul.limit_value) < 1 AND NOT EXISTS (
                                            SELECT 1
                                            FROM email_notifications_list_users enlu
                                            WHERE  enlu.organization_id = ud.organization_id
                                            AND enlu.type = CONCAT('reached_75_off_', ul.limit_value)
                                            AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
                                        ))
                                        OR ((ud.usage_value / ul.limit_value) >= 1 AND NOT EXISTS (
                                            SELECT 1
                                            FROM email_notifications_list_users enlu
                                            WHERE enlu.organization_id = ud.organization_id
                                            AND enlu.type = CONCAT('reached_100_off_', ul.limit_value)
                                            AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
                                        )));`,
                {
                    replacements:data,
                    type: QueryTypes.SELECT
                })

        if (data.length == 0) {
            return {
                type : "RXERROR",
                message:"No record found"
            }
        }

        let title
        let type
        let percentage
        for(let i=0;i<data.length;i++) {
            let users=data[i]
            let aap_id = users.app_id
            switch (aap_id) {
                case 1:
                    title = "credits_reached"
                    break;
                case 2:
                    title = "qamaster_trail_expiry_in_next_2days"
                    break;
            
                default:
                    break;
            }
            let which_one = users.which_one
            // logInfo(which_one)

            if (which_one>=1) {
                 percentage=100
                type = "reached_100_off_"+users.limit_value;
            }
            else if(which_one>=0.75 && which_one < 1){
                 percentage=75
                type = "reached_75_off_"+users.limit_value;
            }else{
                continue
            }
            // else if(which_one>=0.5 && which_one < 0.75){
            //      percentage=50
            //     type = "reached_50_off_100";
            // }
            
            
            let user_id = users.user_id
            let name = users.name
            // let expired_at = users.expiry_date
            const valid = await sendEmailNotification('send_email_on_limit_reached', user_id,{percentage : percentage, aap_id:aap_id})
            // logInfo(valid);
            if (valid) {
                await EmailNotificationsListUser.create({
                    user_id : user_id,
                    type : type,
                    app_id : users.app_id,
                    organization_id:users.organization_id
                })
            }
        }

        return {
            type : "RXERROR",
            message:"Record fetch successfully",
            data : data
        }
    }

    async sendEmailTrailEndedUser(req, res) {
        const input = req.body
        const type = "1_day_expired"
        let days
        if (input.days) {
            days = input.days
        }else{
            days = 1
        }

        const now=moment().utc(true)
        const day1sub=moment().utc(true).subtract(days,"day").format("YYYY-MM-DD HH:mm:ss");

        let data = await ProductTrial.findAll({
            include : [
                {
                    model : User,
                    as:"user"
                },
                {
                    model : EmailNotificationsListUser,
                    where : {
                        type : {
                            [Op.eq] : [type]
                        },
                        app_id: { [Op.eq]:Sequelize.col('ProductTrial.app_id') },
                        organization_id: { [Op.eq]:Sequelize.col('ProductTrial.organization_id') },
                        user_id: { [Op.eq]:Sequelize.col('ProductTrial.user_id') }
                    },
                    required : false
                }
            ],
            where : {
                expiry_date : {
                    [Op.between]: [day1sub,now]
                },
                status : "free_trial"
            }
        })

        data = data.filter((users) => {
            return users.EmailNotificationsListUsers.length == 0
        })

        if (data.length == 0) {
            return res.status(400).send({
                type : "RXERROR",
                message:"No record found"
            })
        }

        let title
        data.forEach(async (users) => {
            let aap_id = users.app_id
            switch (aap_id) {
                case 1:
                    title = "chatbot_trial_expired"
                    break;
                case 2:
                    title = "qamaster_trial_expired"
                    break;
            
                default:
                    break;
            }
            let user_id = users.user_id
            let name = users.user.name
            let expired_at = users.expiry_date
            const valid = await sendEmailNotification(title,user_id,{name : name , expired_at : expired_at})
            logInfo(valid);
            if (valid) {
                await EmailNotificationsListUser.create({
                    user_id : user_id,
                    type : type,
                    app_id : users.app_id,
                    organization_id : users.organization_id
                })
            }
        })

        return res.status(200).send({
            type : "RXERROR",
            message:"Record fetch successfully",
            data : data
        })
    }

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * @return 1 month record whose trail expired.
     */

    async getTrailEndUser(req, res) {
        let month = 1
        const now=moment()
        const month2add=moment().utc(true).subtract(1,"month").format("YYYY-MM-DD HH:mm:ss");

        const data = await ProductTrial.findAll({
            // include : [
            //     {
            //         model : User,
            //         as:"user"
            //     }
            // ],
            where : {
                expiry_date : {
                    // [Op.between]: [Sequelize.literal(`NOW() - INTERVAL ${month} month`),Sequelize.literal(`NOW()`)]
                    [Op.between]: [now,month2add]
                },
                status : "free_trial"
            }
        })


        data.forEach(async (prductTrial) => {
            let customeWhere = {
                organization_id : prductTrial.organization_id,
                project_id : prductTrial.project_id,
                app_id : prductTrial.app_id
            }

            await UsageLimit.update({limit_value : 0},{
                where : customeWhere
            })

            await UsageData.update({usage_value : 0},{
                where : customeWhere
            })
        })

        res.send(data)
    }

    async addOnSubscription(req,res) {
        const input = req.body
        // validate the params
        let result = validateParameters(["subscription_id","quantity","add_on_name"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        };

    try {

        let subscription_id = input.subscription_id
        const quantity = input.quantity
        let user_id = req.authUser.user_id;
        const SubscriptionData = await Subscription.findOne({
            include : [
                {
                    model : User
                }
            ],
            where : {
                id : subscription_id,
                user_id : user_id,
                status : {
                    [Op.in] : ['active','trialing']
                }
            }
        })

        if (!SubscriptionData) {
            return res.status(400).send({
                type : "RXERROR",
                message : "Subscription is not found"
            })
        };

        if (SubscriptionData.status == "trialing") {
            return res.status(400).send({
                type : "RXERROR",
                message : "You can't add add-ons in trial subscription"
            })            
        }
        
        subscription_id = SubscriptionData.subscription_id
        const app_id= SubscriptionData.app_id
        const project_id= SubscriptionData.project_id
        const organization_id= SubscriptionData.organization_id

        const plans = {...config('plan')}
        let add_on
        let add_on_data = []
        switch (app_id) {
            case 1:
                add_on =  "chat_bot_add_on"
                break;
            case 2:
                add_on =  "qa_add_on"
                break;
        
            default:
                break;
        }
        let price
        const add_on_plan = plans.plans[`${app_id}`][`${add_on}`][`${input.add_on_name}`]
        let purpose = add_on_plan?.purpose
        if (!add_on_plan) {
            return res.status(400).send({
                type : "RXERROR",
                message : "plan not found"
            })
        }
        
        if (SubscriptionData.currency == 'usd') {
            price = add_on_plan.stripe_plan_id
        }
        if (SubscriptionData.currency == 'inr') {
            price = add_on_plan.inr_stripe_plan_id
        }
        
        let subscription_benefits = JSON.parse(SubscriptionData.subscription_benefits)

        if (subscription_benefits.recurring_interval != add_on_plan.recurring_interval) {
            return res.status(400).send({
                type : "RXERROR",
                message : `you have a ${subscription_benefits.recurring_interval} subscription,so you cannot add ${add_on_plan.recurring_interval} add-ons.`
            })
        }
        // if (add_on_plan.use_for == "agency" && subscription_benefits.use_for != "agency") {
        //     return res.status(400).send({
        //         type : "RXERROR",
        //         message : `You can't purchase this plan for agency.`
        //     })           
        // }

        if (subscription_benefits?.add_on) {
            let prev_add_on = subscription_benefits?.add_on.find((item) => {
                return item.name == input.add_on_name
            })
            if (prev_add_on) {
                return res.status(400).send({
                    type : "RXERROR",
                    message : "Already added this add_on please change the quantity"
                })
            }
        }
        if (add_on_plan.max_limit < input.quantity) {
            return res.status(400).send({
                type : "RXERROR",
                message : `You've hit the maximum limit for purchasing quantity.`
            })
        }

        purpose.forEach((purpose_item) => {
            // if (typeof subscription_benefits[purpose_item] != "undefined") {
            //     subscription_benefits[purpose_item] = subscription_benefits[purpose_item] + add_on_plan[purpose_item] * input.quantity
            // }
            if (typeof subscription_benefits[purpose_item] != "undefined") {
                const regex = /^(\d+)\/∞$/;
                if (regex.test(subscription_benefits[purpose_item])) {
                    subscription_benefits[purpose_item] = `${Number(subscription_benefits[purpose_item].split('/')[0]) + add_on_plan[purpose_item] * input.quantity}` + "/" + "∞"
                }else if(subscription_benefits[purpose_item] == "∞"){
                    subscription_benefits[purpose_item] = subscription_benefits[purpose_item]
                }else{
                    subscription_benefits[purpose_item] = subscription_benefits[purpose_item] + add_on_plan[purpose_item] * input.quantity
                }
            }
        });

        if (subscription_benefits?.add_on) {
            subscription_benefits?.add_on.push({name : input.add_on_name , quantity : input.quantity})
        }else{
            add_on_data.push({name : input.add_on_name , quantity : input.quantity})
            subscription_benefits.add_on = add_on_data
        }
        let add_ons = subscription_benefits?.add_on
        delete subscription_benefits.add_on;

        let subscription;

        switch(SubscriptionData.collection_method){
            case "paddle" :

            price = add_on_plan.paddle_plan_id;

            let previous_items = (await paddle.subscriptions.get(subscription_id)).items;
            let items = previous_items.map((item)=>{
                return {
                    price_id : item.price.id
                }
            });

            items.push({ price_id:  price, quantity: Number(quantity) });

                const custom_data =  {
                    "app_id": SubscriptionData.app_id,
                    "organization_id": organization_id,
                    "plan_id": SubscriptionData.plan_id,
                    "plan_name": SubscriptionData.plan_name,
                    "subscription_benefits": JSON.stringify(subscription_benefits),
                    "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : undefined ,
                    "user_id": SubscriptionData.user_id
                };

                subscription = await paddle.subscriptions.update(
                    subscription_id,
                    {
                        items : items,
                        prorationBillingMode: "full_immediately",
                        customData : custom_data
                    }
                );
                await updateUsageLimitbyAppId(app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(subscription.customData.subscription_benefits), add_on: subscription.customData?.add_on ? JSON.parse(subscription.customData.add_on) : undefined}))
                // await updateUsageDatabyAppId(app_id,project_id,organization_id,subscription.customData.subscription_benefits);

            break;

            default :
        
                const metadata=  {
                    "app_id": SubscriptionData.app_id,
                    "email": SubscriptionData.User.email,
                    "newCustomer": "false",
                    "organization_id": organization_id,
                    "plan_id": SubscriptionData.plan_id,
                    "plan_name": SubscriptionData.plan_name,
                    "subscription_benefits": JSON.stringify(subscription_benefits),
                    "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : '' ,
                    "user_id": SubscriptionData.user_id
                };

                const proration_date = SubscriptionData.current_period_start;
                subscription = await stripe.subscriptions.update(
                    subscription_id,
                    {
                        proration_behavior: 'create_prorations',
                        proration_date: proration_date,
                        items :[
                            {
                                price : price,
                                quantity : quantity,
                                metadata :metadata
                            },
                        ],
                        metadata :metadata
                    }
                );
                await updateUsageLimitbyAppId(app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(subscription.metadata.subscription_benefits), add_on: subscription.metadata?.add_on ? JSON.parse(subscription.metadata.add_on) : undefined}))
                // await updateUsageDatabyAppId(app_id,project_id,organization_id,subscription.metadata.subscription_benefits)    

            break;
        }
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Add on added successful",
                data : {
                    add_on : [{ name : input.add_on_name , quantity : input.quantity }],
                    subscription : subscription
                }
            })
                
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went wrong"
            })
        }
    }

    async changeSubscriptionAddOn(req, res) {
        const input = req.body
        
        // validate the params
        let result = validateParameters(["subscription_id","quantity","add_on_name"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        let subscription_id = input.subscription_id
        let quantity = Number(input.quantity)
        let user_id = req.authUser.user_id;
        let remove = isset(input.remove, false)
        const subscriptionData = await Subscription.findOne({
            include : [
                {
                    model : User
                }
            ],
            where : {
                id : subscription_id,
                user_id : user_id,
                status : {
                    [Op.in] : ['active','trialing']
                }
            }
        })

        if (!subscriptionData) {
            return res.status(400).send({
                type : "RXERROR",
                message : "Subscription is not found"
            })
        }

        if (subscriptionData.status == "trialing") {
            return res.status(400).send({
                type : "RXERROR",
                message : "You can't change add-on in trial subscription."
            })            
        }

        subscription_id = subscriptionData.subscription_id
        const app_id= subscriptionData.app_id
        const project_id= subscriptionData.project_id
        const organization_id= subscriptionData.organization_id
        let subscription_benefits = JSON.parse(subscriptionData.subscription_benefits);
        const plans = {...config('plan')}
        let add_on
        let add_on_data = []
        switch (app_id) {
            case 1:
                add_on =  "chat_bot_add_on"
                break;
            case 2:
                add_on =  "qa_add_on"
                break;
        
            default:
                break;
        }
        let price
        const add_on_plan = plans.plans[`${app_id}`][`${add_on}`][`${input.add_on_name}`]
        if (!add_on_plan) {
            return res.status(400).send({
                type : "RXERROR",
                message : "plan not found"
            })
        }
        const purpose = add_on_plan.purpose
        let pre_add_on = subscription_benefits.add_on.find((item) => {
            return item.name == input.add_on_name
        })
        if (!pre_add_on) {
            return res.status(400).send({
                type : "RXERROR",
                message : "please purchase add_on first for the same plan"
            })
        }
        if (add_on_plan.max_limit < input.quantity) {
            return res.status(400).send({
                type : "RXERROR",
                message : `You've hit the maximum limit for purchasing quantity.`
            })
        };
        let removeAll = false
        if (remove) {
            if (quantity == 0) {
                return res.status(400).send({
                    type : "RXERROR",
                    message : "please enter quanity greater than 0"
                })
            } else if (Number(pre_add_on.quantity) == Number(quantity) ) {
                removeAll = true
            } else if (Number(pre_add_on.quantity) < Number(quantity)) {
                return res.status(400).send({
                    type : "RXERROR",
                    message : "please enter quanity less than or equal to purchased quantity"
                })
            }
            quantity = Number(pre_add_on.quantity) - Number(quantity)
        } else {
            quantity = Number(pre_add_on.quantity) + Number(quantity)
        }
        let errorObj = { type: "RXSUCCESS" }
        for (let i = 0; i < purpose.length; i++) {
            const purpose_item = purpose[i];
            let check_benefit_value = true
            let condition = false,checkUsageData = null
            // subscription_benefits[purpose_item] = subscription_benefits[purpose_item] + add_on_plan[purpose_item] * quantity - add_on_plan[purpose_item] * pre_add_on.quantity
            if (typeof subscription_benefits[purpose_item] != "undefined") {
                const regex = /^(\d+)\/∞$/;
                if (regex.test(subscription_benefits[purpose_item])) {
                    subscription_benefits[purpose_item] = `${Number(subscription_benefits[purpose_item].split('/')[0]) + add_on_plan[purpose_item] * quantity - add_on_plan[purpose_item] * pre_add_on.quantity}` + "/" + "∞"
                }else if(subscription_benefits[purpose_item] == "∞"){
                    subscription_benefits[purpose_item] = subscription_benefits[purpose_item]
                    check_benefit_value = false
                }else{
                    subscription_benefits[purpose_item] = subscription_benefits[purpose_item] + add_on_plan[purpose_item] * quantity - add_on_plan[purpose_item] * pre_add_on.quantity
                }
            }
            if (remove) {
                checkUsageData = await UsageData.findOne({
                    where : {
                        app_id : app_id,
                        organization_id : organization_id,
                        usage_type : purpose_item,
                    }
                })
                condition = typeof subscription_benefits[purpose_item] != "undefined" ? Number(isset(String(subscription_benefits[purpose_item]).split('/')[0],0)) - Number(checkUsageData?.usage_value) < 0 : Number(add_on_plan[purpose_item] * quantity) - Number(checkUsageData?.usage_value) < 0
                if (check_benefit_value && checkUsageData && condition) {
                    errorObj = {
                        type : "RXERROR",
                        message : `The add-on ${input.add_on_name} cannot be removed since you have used ${purpose_item} more than its limit.`
                    }
                    break;
                }
            }
        }
        if (errorObj.type == "RXERROR") {
            return res.status(400).send(errorObj)
        }
        if (removeAll) {
            if (subscription_benefits?.add_on.length == 1) {
                delete subscription_benefits.add_on
            }else{
                subscription_benefits?.add_on?.forEach((item,i) => {
                    if (item.name == input.add_on_name) {
                        const data = subscription_benefits.add_on.splice(i,1)
                        logInfo(data);
                    }
                })
            }
        } else {
            subscription_benefits?.add_on.forEach((add_on_data) => {
                if (add_on_data.name == input.add_on_name) {
                    add_on_data.quantity = quantity
                }
            })
        }
        let add_ons = subscription_benefits?.add_on
        delete subscription_benefits.add_on

        try {
            let subscription = null;
            let data = null;
            let items = null;
            let result = null;
            switch(subscriptionData.collection_method){
                case "paddle" : 
                    price = add_on_plan.paddle_plan_id;

                    subscription = await paddle.subscriptions.get(subscriptionData.subscription_id);
                    data = subscription.items;

                    items = [];

                    data.forEach((item)=>{
                        if(item.price.id === price) {
                            if (!removeAll) items.push({ price_id : price, quantity : quantity })
                        }
                        else items.push({ price_id : item.price.id });
                    });

                    if(items.length > 0) {

                        // subscription_benefits?.add_on.forEach((add_on_data) => {
                        //     if (add_on_data.name == input.add_on_name) {
                        //         add_on_data.quantity = quantity
                        //     }
                        // })
                        // let add_ons = subscription_benefits?.add_on
                        // delete subscription_benefits.add_on
                
                        let updated_data = {
                            items: items,
                            customData: {
                                "app_id": subscriptionData.app_id,
                                "organization_id": organization_id,
                                "plan_id": subscriptionData.plan_id,
                                "plan_name" : subscriptionData.plan_name,
                                "user_id": subscriptionData.user_id,
                                "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : undefined,
                                "subscription_benefits": JSON.stringify(subscription_benefits)        
                            },
                            prorationBillingMode: "full_immediately"
                        };
                        logInfo(updated_data);
                        result = await paddle.subscriptions.update(subscriptionData.subscription_id,updated_data);
                        await updateUsageLimitbyAppId(subscriptionData.app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(result.customData.subscription_benefits), add_on: result.customData?.add_on ? JSON.parse(result.customData.add_on) : undefined}))
                    };

                    break;
                default :

                    if (subscriptionData.currency == 'usd') {
                        price = add_on_plan.stripe_plan_id
                    }
                    if (subscriptionData.currency == 'inr') {
                        price = add_on_plan.inr_stripe_plan_id
                    }
            
                    const proration_date = subscriptionData.current_period_start;
                    subscription = await stripe.subscriptions.retrieve(subscriptionData.subscription_id);
                    data = subscription.items.data
                    const price_id = subscriptionData.gateway_plan_id
                    
                    data = data.find((item) => {
                        return item.plan.id == price
                    })
                    
                    items = [data].map((item) => {
                        if (removeAll) {
                            return {
                                id: item.id,
                                deleted : true
                            }                
                        }
                        return {
                            id: item.id,
                            price: price,
                            quantity:quantity
                        }
                    })
                    logInfo(items);
                    // subscription_benefits = JSON.stringify(subscription_benefits)
                    logInfo(subscription_benefits);
                    const metadata=  {
                        "app_id": subscriptionData.app_id,
                        "email": req.authUser.User.email,
                        "newCustomer": "false",
                        "organization_id": organization_id,
                        "plan_id": subscriptionData.plan_id,
                        "plan_name": subscriptionData.plan_name,
                        "subscription_benefits": JSON.stringify(subscription_benefits),
                        "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : '' ,
                        "user_id": subscriptionData.user_id
                    }
                    result = await stripe.subscriptions.update(subscription_id, {
                        // cancel_at_period_end: false,
                        proration_behavior: 'create_prorations',
                        metadata : metadata,
                        items: items,
                        proration_date: proration_date,
                    });

                    await updateUsageLimitbyAppId(subscriptionData.app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(result.metadata.subscription_benefits), add_on: result.metadata?.add_on ? JSON.parse(result.metadata.add_on) : undefined}))
                    break;
            }
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Add on updated successful",
                data : result
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "something went wrong"
            });
        }
        
    }

    async removeSubscriptionAddOn(req, res) {
        const input = req.body
        
        // validate the params
        let result = validateParameters(["subscription_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        let subscription_id = input.subscription_id
        let user_id = req.authUser.user_id;
        const subscriptionData = await Subscription.findOne({
            include : [
                {
                    model : User
                }
            ],
            where : {
                id : subscription_id,
                user_id : user_id
            }
        })

        if (!subscriptionData) {
            return res.status(400).send({
                type : "RXERROR",
                message : "Subscription is not found"
            })
        }
        if (subscriptionData.status == "trialing") {
            return res.status(400).send({
                type : "RXERROR",
                message : "You can't remove add-on in trial subscription."
            })            
        } else if (subscriptionData.status != "active") {
            return res.status(400).send({
                type : "RXERROR",
                message : "Subscription is not active"
            })
        }

        subscription_id = subscriptionData.subscription_id
        const app_id= subscriptionData.app_id
        const project_id= subscriptionData.project_id
        const organization_id= subscriptionData.organization_id
        let subscription_benefits = JSON.parse(subscriptionData.subscription_benefits)
        logInfo(subscription_benefits);
        if (!subscription_benefits?.add_on) {
            return res.status(400).send({
                type : "RXERROR",
                message : "please purchase add_on first"
            })
        }

        const plans = {...config('plan')}
        let add_on
        let add_on_data = []
        switch (app_id) {
            case 1:
                add_on =  "chat_bot_add_on"
                break;
            case 2:
                add_on =  "qa_add_on"
                break;
        
            default:
                break;
        }
        let price,remove_add_on
        const proration_date = subscriptionData.current_period_start;;
        const subscription = await stripe.subscriptions.retrieve(subscriptionData.subscription_id);
        let line_items = subscription.items.data
        const price_id = subscriptionData.gateway_plan_id
        let purpose , plan_to_remove = [], errorObj = { type: "RXSUCCESS" }
        if (input.add_on_name) {
            const add_on_plan = plans.plans[`${app_id}`][`${add_on}`][`${input.add_on_name}`]
            if (!add_on_plan) {
                return res.status(400).send({
                    type : "RXERROR",
                    message : "plan not found"
                })
            }
            // plan_to_remove[0] = {name : input.add_on_name}
            
            if (subscriptionData.currency == 'usd') {
                price = add_on_plan.stripe_plan_id
            }
            if (subscriptionData.currency == 'inr') {
                price = add_on_plan.inr_stripe_plan_id
            }
            remove_add_on = line_items.filter((item) => {
                return item.plan.id == price
            })
            let pre_add_on = subscription_benefits.add_on.find((item) => {
                return item.name == input.add_on_name
            })
            if (!pre_add_on) {
                return res.status(400).send({
                    type : "RXERROR",
                    message : "please purchase add_on first for the same plan"
                })
            }
            purpose = add_on_plan.purpose
            for (let i = 0; i < purpose.length; i++) {
                const purpose_item = purpose[i];
                let check_benefit_value = true
                if (typeof subscription_benefits[purpose_item] != "undefined") {
                    const regex = /^(\d+)\/∞$/;
                    if (regex.test(subscription_benefits[purpose_item])) {
                        subscription_benefits[purpose_item] = `${Number(subscription_benefits[purpose_item].split('/')[0]) - add_on_plan[purpose_item] * pre_add_on.quantity}` + "/" + "∞"
                        check_benefit_value = false
                    }else if(subscription_benefits[purpose_item] == "∞"){
                        subscription_benefits[purpose_item] = subscription_benefits[purpose_item]
                        check_benefit_value = false
                    }else{
                        subscription_benefits[purpose_item] = subscription_benefits[purpose_item] - add_on_plan[purpose_item] * pre_add_on.quantity
                    }
                    // subscription_benefits[purpose_item] = subscription_benefits[purpose_item] - add_on_plan[purpose_item] * pre_add_on.quantity
                }
                if (check_benefit_value) {
                    let checkUsageData = await UsageData.findOne({
                        where : {
                            app_id : app_id,
                            organization_id : organization_id,
                            usage_type : purpose_item,
                        }
                    })
                    let condition = typeof subscription_benefits[purpose_item] != "undefined" ? Number(isset(subscription_benefits[purpose_item],0)) - Number(checkUsageData?.usage_value) < 0 : Number(add_on_plan[purpose_item] * pre_add_on.quantity) - Number(checkUsageData?.usage_value) < 0
                    if (checkUsageData && condition ) {
                        errorObj = {
                            type : "RXERROR",
                            message : `The add-on ${input.add_on_name} cannot be removed since you have used ${purpose_item} more than its limit.`
                        }
                        break;
                    }
                }
            }
            if (errorObj.type == "RXERROR") {
                return res.status(400).send(errorObj)
            }
            
            if (subscription_benefits?.add_on.length == 1) {
                delete subscription_benefits.add_on
            }else{
                subscription_benefits?.add_on?.forEach((item,i) => {
                    if (item.name == input.add_on_name) {
                        const data = subscription_benefits.add_on.splice(i,1)
                        logInfo(data);
                    }
                })
            }
        }
        else{
            remove_add_on = line_items.filter((item) => {
                return item.plan.id != price_id
            })
            for (let j = 0; j < subscription_benefits?.add_on.length; j++) {
                const item = subscription_benefits?.add_on[j];
                let add_on_plan = plans.plans[`${app_id}`][`${add_on}`][`${item.name}`]
                purpose = add_on_plan.purpose
                for (let i = 0; i < purpose.length; i++) {
                    const purpose_item = purpose[i];
                    let check_benefit_value = true
                    if (typeof subscription_benefits[purpose_item] != "undefined") {
                        const regex = /^(\d+)\/∞$/;
                        if (regex.test(subscription_benefits[purpose_item])) {
                            subscription_benefits[purpose_item] = `${Number(subscription_benefits[purpose_item].split('/')[0]) - add_on_plan[purpose_item] * item.quantity}` + "/" + "∞"
                            check_benefit_value = false
                        }else if(subscription_benefits[purpose_item] == "∞"){
                            subscription_benefits[purpose_item] = subscription_benefits[purpose_item]
                            check_benefit_value = false
                        }else{
                            subscription_benefits[purpose_item] = subscription_benefits[purpose_item] - add_on_plan[purpose_item] * item.quantity
                        }
                    }
                    if (check_benefit_value) {
                        let checkUsageData = await UsageData.findOne({
                            where : {
                                app_id : app_id,
                                organization_id : organization_id,
                                usage_type : purpose_item,
                            }
                        })
                        let condition = typeof subscription_benefits[purpose_item] != "undefined" ? Number(isset(subscription_benefits[purpose_item],0)) - Number(checkUsageData?.usage_value) < 0 : Number(add_on_plan[purpose_item] * item.quantity) - Number(checkUsageData?.usage_value) < 0
                        if (checkUsageData && condition ) {
                            errorObj = {
                                type : "RXERROR",
                                message : `The add-on ${input.add_on_name} cannot be removed since you have used ${purpose_item} more than its limit.`
                            }
                            break;
                        }
                    }
                }
                if (errorObj.type == "RXERROR") {
                    break;
                }
            }
            if (errorObj.type == "RXERROR") {
                return res.status(400).send(errorObj)
            }
            // plan_to_remove = subscription_benefits.add_on
            delete subscription_benefits.add_on
        }
        
        const items = remove_add_on.map((item) => {
            return {
                id : item.id, 
                deleted : true
            }
        })
        let add_ons = subscription_benefits?.add_on
        delete subscription_benefits.add_on
        // subscription_benefits = JSON.stringify(subscription_benefits)
        const metadata=  {
            "app_id": subscriptionData.app_id,
            "email": req.authUser.User.email,
            "newCustomer": "true",
            "organization_id": organization_id,
            "plan_id": subscriptionData.plan_id,
            "plan_name": subscriptionData.plan_name,
            "subscription_benefits": JSON.stringify(subscription_benefits),
            "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : '' ,
            "user_id": subscriptionData.user_id
        }
        // dd(metadata);
        try {
            const result = await stripe.subscriptions.update(subscription_id, {
                // cancel_at_period_end: false,
                // proration_behavior: 'create_prorations',
                metadata : metadata,
                items: items,
                // proration_date: proration_date,
            });

            // const benefits = JSON.parse(result.metadata.subscription_benefits)
            // const plan_id = benefits.plan_id
            // const features = benefits.features
            // for (let i = 0; i < plan_to_remove.length; i++) {
            //     let plan_data = plans.plans[`${app_id}`][`${add_on}`][plan_to_remove[i].name]
            //     let purpose = plan_data.purpose
            //     for (let j = 0; j < purpose.length; j++) {
            //         const purpose_item = purpose[j];
            //         if (!features.includes(purpose_item)) {
            //             await UsageLimit.update({limit_value : 0},{
            //                 where : {
            //                     app_id : app_id,
            //                     organization_id : organization_id,
            //                     limit_type : purpose_item
            //                 }
            //             })
            //             await UsageData.update({usage_value : 0},{
            //                 where : {
            //                     app_id : app_id,
            //                     organization_id : organization_id,
            //                     usage_type : purpose_item
            //                 }
            //             })
            //         }
            //     }
            // }
            await updateUsageLimitbyAppId(subscriptionData.app_id,project_id,organization_id,JSON.stringify({ ...JSON.parse(result.metadata.subscription_benefits), add_on: result.metadata?.add_on ? JSON.parse(result.metadata.add_on) : undefined}))
            //await updateUsageDatabyAppId(subscriptionData.app_id,project_id,organization_id,result.metadata.subscription_benefits)

            return res.status(200).send({type:"RXSUCCESS",message:"Subscription Updated data",data:result})
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "something went wrong"
            });
        }
        
    }

    async getUnPaidInvoice(req, res) {
        const input = req.body
        
        // validate the params
        let result = validateParameters(["subscription_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        let subscription_id = input.subscription_id
        let user_id = req.authUser.user_id;
        const invoice_data = await Invoice.findOne({
            where : {
                subscription_id : subscription_id,
                status : "open",
                billing_reason :"subscription_update"
            }
        })

        if (!invoice_data) {
            return res.status(400).send({
                type : "RXERROR",
                message : "Invoice not found"
            })
        }
        return res.status(200).send({
            type : "RXSUCCESS",
            message : "Invoice detail",
            data : invoice_data
        })
    }

    async undoSubscriptionUpgrade(req, res) {
        const input = req.body
        
        // validate the params
        let result = validateParameters(["subscription_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        let subscription_id = input.subscription_id
        let user_id = req.authUser.user_id;
        var invoice_data = await Invoice.findOne({
            include : [
                {
                    model : Subscription,
                    as : "subscription_data"
                }
            ],
            where : {
                subscription_id : subscription_id,
                status : "open",
                billing_reason :"subscription_update"
            }
        })

        if (!invoice_data) {
            return res.status(400).send({
                type : "RXERROR",
                message : "Invoice not found"
            })
        }
        let invoice_id = invoice_data.invoice_id
        let project_id = invoice_data.subscription_data.project_id
        let organization_id = invoice_data.subscription_data.organization_id
        let plan_id = invoice_data.subscription_data.plan_id
        let app_id = invoice_data.subscription_data.app_id
        let plan_name = invoice_data.subscription_data.plan_name
        let subscription_benefits = invoice_data.subscription_data.subscription_benefits
        subscription_benefits = JSON.parse(subscription_benefits)
        let add_ons = subscription_benefits.add_on
        delete subscription_benefits.add_on
        subscription_id = invoice_data.subscription_data.subscription_id
        try {
            invoice_data = await stripe.invoices.voidInvoice(
                invoice_id
              );
              await stripe.subscriptions.update(
                subscription_id,
                {
                    metadata: {
                        'user_id': user_id,
                        'project_id': project_id,
                        'organization_id':organization_id,
                        'plan_id': plan_id,
                        'app_id':app_id,
                        'plan_name':plan_name,
                        'subscription_benefits':JSON.stringify(subscription_benefits),
                        "add_on" : add_ons && add_ons.length > 0 ? JSON.stringify(add_ons) : '' ,
                        'newCustomer':false,
                    }
                }
              );
              return res.status(200).send({
                type : "RXSUCCESS",
                message : "Invoice detail",
                data : invoice_data
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went wrong"
            })
        }
        
    }

    async manageBilling(req,res){
        const input = req.body
        // validate the params
        let result = validateParameters(["return_url"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        let user_id = req.authUser.user_id
        let return_url = input.return_url
        const subscription_data = await Subscription.findOne({
            where : {
                user_id : user_id,
                collection_method : {
                    [Op.ne] : "paddle"
                }
            }
        })

        if (!subscription_data) {
            return res.status(400).send({
                type : "RXERROR",
                message : "Please purchase a plan first"
            })
        }
        let customer_id = subscription_data.customer_id

        try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customer_id,
            return_url: return_url,
            });
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "customer billing detail url",
                data : session
            })
        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went to be wrong"
            })
        }
    }

    /**
    * 
    * @param {*} req 
    * @param {*} res 
    * @returns 
    * 
    * set subscription active before trail ends
    */

    async updateTrialToActiveSubscription(req, res) {
        const input = req.body
        
        // validate the params
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
        const permission =await userPrivilege({type :'organization',searchParam :{user_id:user_id,organization_id: input.organization_id},allowedRole:["owner"]})
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        const subscriptionData = await Subscription.findOne({
            where : {
                organization_id : input.organization_id,
                app_id : 1,
            }
        })

        if (!subscriptionData) {
            return res.status(400).send({
                type : "RXERROR",
                message : "Subscription is not found"
            })
        }

        if (subscriptionData.collection_method == "paddle" || subscriptionData.status == "manual") {
            return res.status(400).send({
                type : "RXERROR",
                message : "This subscription does not have this feature"
            })            
        } else if (subscriptionData.status != "trialing") {
            return res.status(400).send({
                type : "RXERROR",
                message : "Subscription is not in trial"
            })
        }

        let subscription_id = subscriptionData.subscription_id
        try {
            let subscription_data = await stripe.subscriptions.update(subscription_id,{ trial_end: 'now'});
            return res.status(200).send({
                type : "RXSUCCESS",
                message : "Subscription updated",
                data : subscription_data
            })
        }
        catch (error) {
            logInfo(error);
            return res.status(400).send({
                type : "RXERROR",
                message : "Something went to be wrong"
            })
        }
    }

    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * @returns 
     * 
     * webhook url events define here
     */
    async subscriptionWebHook(req, res) {
        logInfo("subscriptionWebHook",req.body);
       
        try {
            logInfo(req.body.type)
            logInfo(req.body)
            // res.status(200).json({received: true});
            switch (req.body.type) {
                case "customer.subscription.deleted":
                    logInfo(req.body.type);
                    await subscriptionUpdate(req.body.data.object.id,{
                        status : req.body.data.object.status,
                        canceled_at : req.body.data.object.canceled_at,
                        cancel_at : req.body.data.object.cancel_at
                    })
                    let customWhere = {
                        organization_id : typeof req?.body?.data?.object?.metadata?.organization_id == 'undefined' ? null : req?.body?.data?.object?.metadata?.organization_id,
                        project_id : typeof req?.body?.data?.object?.metadata?.project_id == 'undefined' ? null : req?.body?.data?.object?.metadata?.project_id,
                        app_id : req?.body?.data?.object?.metadata?.app_id,
                    }
                    await setUsageNull(UsageLimit,{limit_value:0},customWhere)
                    await brevoUpdate(req.body.data.object)
                    break;
                case "customer.subscription.created":
                    subscriptionCreated(req.body.data.object)
                    break;
                case "customer.subscription.updated":
                    let plan_name , plan_id , subscription_benefits , gateway_plan_id
                    if (req.body.data.object.status == "past_due") {
                        plan_name = undefined
                        plan_id = undefined
                        subscription_benefits = undefined
                        gateway_plan_id = undefined
                        plan_name = undefined

                        let customWhere = {
                            organization_id : typeof req?.body?.data?.object?.metadata?.organization_id == 'undefined' ? null : req?.body?.data?.object?.metadata?.organization_id,
                            project_id : typeof req?.body?.data?.object?.metadata?.project_id == 'undefined' ? null : req?.body?.data?.object?.metadata?.project_id,
                            app_id : req?.body?.data?.object?.metadata?.app_id,
                        }
                        await setUsageNull(UsageLimit,{limit_value:0},customWhere)
                    }else{
                        plan_name = req.body.data.object.metadata.plan_name
                        plan_id = req.body.data.object.metadata.plan_id
                        if (req.body.data.object.metadata.add_on) {
                            subscription_benefits = JSON.parse(req.body.data.object.metadata.subscription_benefits)
                            subscription_benefits.add_on = JSON.parse(req.body.data.object.metadata.add_on)
                            subscription_benefits = JSON.stringify(subscription_benefits)
                        }else{
                            subscription_benefits = req.body.data.object.metadata.subscription_benefits
                        }
                        gateway_plan_id = req.body.data.object.items.data[0].plan.id 
                    }
                    await subscriptionUpdate(req.body.data.object.id,{
                        status : req.body.data.object.status, 
                        plan_name : plan_name, 
                        plan_id : plan_id, 
                        subscription_benefits : subscription_benefits,
                        gateway_plan_id : gateway_plan_id,
                        created : req.body.data.object.created,
                        current_period_end : req.body.data.object.current_period_end,
                        current_period_start : req.body.data.object.current_period_start,
                        cancel_at_period_end:req.body.data.object.cancel_at_period_end,
                        cancel_at:req.body.data.object.cancel_at,
                        canceled_at:req.body.data.object.canceled_at
                    })
                    if (!req.body.data.object.cancel_at_period_end) {
                        await getUpcomingInvoice({subscription : req.body.data.object.id , customer : req.body.data.object.customer},"customer.subscription.updated")
                    }
                    await brevoUpdate(req.body.data.object)

                    let notifyWebhookData = `Subscription Updated: \`\`\`Status: ${req.body.data.object.status} \nPlan Name: ${plan_name} \nCustomer: ${JSON.stringify(req.body.data.object.customer)} \nuser_id = ${req?.body?.data?.object?.subscription_details?.metadata?.user_id} \nBenefits: ${JSON.stringify(subscription_benefits)} \`\`\` `
                    await notifyOnDiscord(notifyWebhookData,"payment")
                    break;
                case "checkout.session.completed":
                    // await getSubscriptionById(req.body.data.object.subscription)
                    break;
                case "invoice.paid":
                    logInfo("invoice.paid +++++++++++++",req.body.data.object.metadata);
                    getSubscriptionById(req.body.data.object.subscription)
                    await invoiceCreate(req.body.data.object)
                    if (req.body.data.object?.discount?.promotion_code) {
                        await discountSubscriptionCreate(req.body.data.object)
                    }
                    if (req.body.data.object.billing_reason == "subscription_update") {
                        let data1 = await await stripe.subscriptions.retrieve(
                            req.body.data.object.subscription
                        );
                        data1 = data1.metadata
                        let plan_benefits = data1?.subscription_benefits
                        if (data1.add_on) {
                            plan_benefits = JSON.parse(plan_benefits)
                            plan_benefits = JSON.stringify({...plan_benefits , ...{add_on : JSON.parse(data1.add_on)}})
                        }
                        let project_id = typeof data1?.project_id == "undefined" ? null : data1.project_id;
                        let organization_id = data1?.organization_id;
                        let app_id = data1.app_id;
                        let customWhere = {}
                        if (project_id) {
                            customWhere = {
                                project_id:project_id,
                                app_id:app_id
                            }
                        }else if(organization_id) {
                            customWhere = {
                                organization_id:organization_id,
                                app_id:app_id
                            }
                        }
                        await upgradeUsageDatabyAppId(app_id,project_id,organization_id,plan_benefits)
                    }else{
                        await usageData(req.body.data.object.subscription)
                    }
                    await usageLimit(req.body.data.object.subscription)
                    await getUpcomingInvoice(req.body.data.object)
                    const newCustomer = req.body.data.object.lines.data[0].metadata.newCustomer
                    if (newCustomer === true) {
                        await setThriveReferral(req.body.data.object.subscription)
                    }
                    const strdata = `New Subscription Paid: \`\`\`user_id = ${req.body.data.object.subscription_details?.metadata?.user_id} , total = ${req.body.data.object.total},subtotal = ${req.body.data.object.subtotal}, organization_id = ${req.body.data.object.subscription_details?.metadata?.organization_id},subscription_id  = ${req.body.data.object.subscription}\`\`\``
                    await notifyOnDiscord(strdata,"payment")
                    break;
                case "invoice.payment_failed":
                    await invoiceCreate(req.body.data.object)
                    break;
                case "invoice.updated":
                    await invoiceCreate(req.body.data.object)
                    break;
                case "charge.succeeded":
                    await chargeCreate(req.body.data.object)
                    break;
                case "charge.failed":
                    await chargeCreate(req.body.data.object)
                    break;
                case "charge.expired":
                    await chargeCreate(req.body.data.object)
                    break;
                case "charge.pending":
                    await chargeCreate(req.body.data.object)
                    break;
                case "invoice.upcoming":
                    logInfo(req.body.data.object);
                    break;
            
                default:
                    break;
            }
            return res.status(200).json({received: true});
        } catch (err) {
            logInfo(err);
            return res.status(400).send(err);
        }

    }


    /**
     * 
     * @param {*} req 
     * @param {*} res 
     * @returns 
     * 
     * webhook url events define here
     */
    async paddleSubscriptionWebHook(req, res) {
        logInfo("subscriptionWebHook",req.body);
        let notifyWebhookData = null;
        let subscription_benefits = null;
        let validate_subscription = null;
       
        try {
            logInfo(req.body.event_type);
            if (req?.body?.data?.custom_data?.subscription_benefits) subscription_benefits = JSON.stringify({...JSON.parse(req.body.data.custom_data.subscription_benefits)});
            if(req?.body?.data?.custom_data?.add_on) {
                if(subscription_benefits){
                    subscription_benefits = JSON.stringify({...JSON.parse(subscription_benefits),...{add_on : JSON.parse(req.body.data.custom_data.add_on)}});
                } else{
                    subscription_benefits = JSON.stringify({add_on : JSON.parse(req.body.data.custom_data.add_on)});
                }
            };            
            switch (req.body.event_type) {
                case "subscription.canceled":
                    logInfo(req.body.event_type);
                    await subscriptionUpdate(req.body.data.id,{
                        status : req.body.data.status,
                        cancel_at : getUnixTime(req.body.data.canceled_at)
                    });
                    let customWhere = {
                        organization_id : typeof req?.body?.data?.custom_data?.organization_id == 'undefined' ? null : req?.body?.data?.custom_data?.organization_id,
                        project_id : typeof req?.body?.data?.custom_data?.project_id == 'undefined' ? null : req?.body?.data?.custom_data?.project_id,
                        app_id : req?.body?.data?.custom_data?.app_id,
                    };

                    await setUsageNull(UsageLimit,{limit_value:0},customWhere)
                    await brevoUpdate(req.body.data, "paddle")
                    notifyWebhookData = `Subscription Cancelled: \`\`\`Status: ${req.body.data.status} \nPlan Name: ${req.body.data.custom_data.plan_name} \nCustomer: ${JSON.stringify(req.body.data.customer_id)} \nuser_id = ${req?.body?.data?.custom_data?.user_id} \nBenefits: ${subscription_benefits} \`\`\` `
                    await notifyOnDiscord(notifyWebhookData,"payment")
                    break;
                case "subscription.created":
                    validate_subscription = await validatePaddleSubscription(req.body.data);
                    if(!validate_subscription){
                        notifyWebhookData = `Subscription Unauthorized: \`\`\`SubscriptionId: ${req.body.data.id} \nPlan Name: ${req.body.data.custom_data.plan_name} \nCustomer: ${JSON.stringify(req.body.data.customer_id)} \nuser_id = ${req?.body?.data?.custom_data?.user_id} \nOrganizationId: ${req?.body?.data?.custom_data?.organization_id} \`\`\` `
                        await notifyOnDiscord(notifyWebhookData,"payment")
                    } else{
                        subscription_benefits = await paddleSubscriptionCreated(req.body.data);    
                        notifyWebhookData = `Subscription Created: \`\`\`Status: ${req.body.data.status} \nPlan Name: ${req.body.data.custom_data.plan_name} \nCustomer: ${JSON.stringify(req.body.data.customer_id)} \nuser_id = ${req?.body?.data?.custom_data?.user_id} \nBenefits: ${subscription_benefits} \`\`\` `
                        await notifyOnDiscord(notifyWebhookData,"payment")    
                    }
                    break;
                case "subscription.updated":
                if (req?.body?.data?.custom_data?.subscription_benefits) subscription_benefits = JSON.stringify({...JSON.parse(req.body.data.custom_data.subscription_benefits)});
                if(req?.body?.data?.custom_data?.add_on) {
                    if(subscription_benefits){
                        subscription_benefits = JSON.stringify({...JSON.parse(subscription_benefits),...{add_on : JSON.parse(req.body.data.custom_data.add_on)}});
                    } else{
                        subscription_benefits = JSON.stringify({add_on : JSON.parse(req.body.data.custom_data.add_on)});
                    }
                };    
                    await subscriptionUpdate(req.body.data.id,{
                        status : req.body.data.status, 
                        plan_name : req.body.data.custom_data.plan_name, 
                        plan_id : req.body.data.custom_data.plan_id, 
                        gateway_plan_id : config('plan').plans[req.body.data.custom_data.app_id][req.body.data.custom_data.plan_name].paddle_plan_id,
                        created : getUnixTime(req.body.data.created_at),
                        subscription_benefits: subscription_benefits,
                        current_period_end : getUnixTime(req.body.data.current_billing_period.ends_at),
                        current_period_start : getUnixTime(req.body.data.current_billing_period.starts_at),
                        cancel_at_period_end : req.body.data.scheduled_change?.action === "cancel" ? 1 : 0,
                        cancel_at: getUnixTime(req.body.data.canceled_at)
                    })

                    await brevoUpdate(req.body.data, "paddle")

                    notifyWebhookData = `Subscription Updated: \`\`\`Status: ${req.body.data.status} \nPlan Name: ${req.body.data.custom_data.plan_name} \nCustomer: ${JSON.stringify(req.body.data.customer_id)} \nuser_id = ${req?.body?.data?.custom_data?.user_id} \nBenefits: ${subscription_benefits} \`\`\` `
                    await notifyOnDiscord(notifyWebhookData,"payment")
                    break;
                    case "subscription.past_due":
                        let plan_name , plan_id , gateway_plan_id
                            plan_name = undefined
                            plan_id = undefined
                            subscription_benefits = undefined
                            gateway_plan_id = undefined
    
                            customWhere = {
                                organization_id : typeof req?.body?.data?.custom_data?.organization_id == 'undefined' ? null : req?.body?.data?.custom_data?.organization_id,
                                project_id : typeof req?.body?.data?.custom_data?.project_id == 'undefined' ? null : req?.body?.data?.custom_data?.project_id,
                                app_id : req?.body?.data?.custom_data?.app_id,
                            }
                            await setUsageNull(UsageLimit,{limit_value:0},customWhere);
 
                        await subscriptionUpdate(req.body.data.id,{
                            status : req.body.data.status, 
                            plan_name : plan_name, 
                            plan_id : plan_id, 
                            subscription_benefits : subscription_benefits,
                            gateway_plan_id : gateway_plan_id
                        });
    
                        await brevoUpdate(req.body.data, "paddle")
    
                        notifyWebhookData = `Subscription Past_Due: \`\`\`Status: ${req.body.data.status} \nPlan Name: ${plan_name} \nCustomer: ${JSON.stringify(req.body.data.customer_id)} \nuser_id = ${req?.body?.data?.custom_data?.user_id} \nBenefits: ${subscription_benefits} \`\`\` `
                        await notifyOnDiscord(notifyWebhookData,"payment")
                        break;
                        case "subscription.activated":

                        validate_subscription = await validatePaddleSubscription(req.body.data);
                        if(validate_subscription){

                            subscription_benefits = await paddleSubscriptionCreated(req.body.data);
    
                            await subscriptionUpdate(req.body.data.id,{
                                status : req.body.data.status, 
                                plan_name : req.body.data.custom_data.plan_name, 
                                plan_id : req.body.data.custom_data.plan_id, 
                                gateway_plan_id : config('plan').plans[req.body.data.custom_data.app_id][req.body.data.custom_data.plan_name].paddle_plan_id,
                                created : getUnixTime(req.body.data.created_at),
                                current_period_end : getUnixTime(req.body.data.current_billing_period.ends_at),
                                current_period_start : getUnixTime(req.body.data.current_billing_period.starts_at),
                                cancel_at_period_end : req.body.data.scheduled_change?.action === "cancel" ? 1 : 0,
                                cancel_at: getUnixTime(req.body.data.canceled_at)
                            });
    
                            // Update usage data and limit
                            await usageData(req.body.data.id, "paddle");
                            await usageLimit(req.body.data.id, "paddle");
        
                            await brevoUpdate(req.body.data, "paddle")
        
                            notifyWebhookData = `Subscription Activated: \`\`\`Status: ${req.body.data.status} \nPlan Name: ${req.body.data.custom_data.plan_name} \nCustomer: ${JSON.stringify(req.body.data.customer_id)} \nuser_id = ${req?.body?.data?.custom_data?.user_id} \nBenefits: ${subscription_benefits} \`\`\` `
                            await notifyOnDiscord(notifyWebhookData,"payment")
                        };
     
                        break;    
                case "transaction.updated":
                    await createPaddleCharge(req.body.data)
                    break;
                case "transaction.paid":
                    await createPaddleCharge(req.body.data)
                    break;
                case "transaction.completed":
                    if(req.body.data.origin === "subscription_recurring"){
                        await usageData(req.body.data.subscription_id, "paddle")
                        await usageLimit(req.body.data.subscription_id, "paddle")
                    }
                    await createPaddleCharge(req.body.data)
                    break;
                case "transaction.canceled":
                    await createPaddleCharge(req.body.data)
                    break; 
                case "transaction.payment_failed":
                    await createPaddleCharge(req.body.data)
                    break;      
            
                default:
                    break;
            }
            return res.status(200).json({received: true});
        } catch (err) {
            logInfo(err);
            return res.status(400).send(err);
        }

    }    


    async getActivePlanDetail(req, res) {
        const input = req.body
        let user_id = req.authUser.user_id;
        
        // validate the params
        let result = validateParameters(["id","app_id","type"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }
        let customWhere
        if (input.type == "project") {
            const data = await Project.findOne({
                where : {
                    project_uid : input.id
                }
            })
            if (!data) {
                return res.status(400).send({
                    type: "RXERROR",
                    message: "project not found",
                }); 
            }
            customWhere = {
                app_id : input.app_id,
                project_id : data.id
            }
        }else if (input.type == "organization") {
            customWhere = {
                app_id : input.app_id,
                organization_id : input.id
            }
            
        }else {
            return res.status(400).send({
                type: "RXERROR",
                message: "please send correct type input",
            });
        }

        try {
            let UsageLimitData = await UsageLimit.findAll({
                where : customWhere
            })
            let UsageDataData = await UsageData.findAll({
                where : customWhere
            });

            if(UsageLimitData.length<1){
                return res.status(400).send({
                    type: "RXERROR",
                    message: "data not found",
                }) 
            }
            // customWhere["status"] = { [Op.in] : ["draft","paid",'open'] } 
            // let invoices = await Invoice.findAll({
            //     where : customWhere,
            //     order : [["created_at","desc"]]
            // }) 
            // let paid_invoice = invoices.filter((invoice) => {
            //     return invoice.status == "paid"
            // })
            // let next_billing_cycle = invoices.find((invoice) => {
            //     return invoice.status == "draft" && invoice.billing_reason == "upcoming"
            // })

            // let pending_invoice_to_pay = invoices.find((invoice) => {
            //     return invoice.status == "open" && invoice.billing_reason == "subscription_update"
            // })
            // return res.send(pending_invoice_to_pay)
            // let invoice_id = pending_invoice_to_pay.invoice_id
            // const invoice_data = await stripe.invoices.retrieve(
            //     invoice_id
            //   );
            // let pastDuePlanDetail = invoice_data.subscription_details.metadata

            let formattedData={}
            let plan_id=null;
            let organization_id=null;
            let project_id=null;
            let app_id=null;
            let plan_name=null;
            let status=null;
            UsageLimitData.forEach((limit)=>{
                let key=limit.limit_type;
                plan_id=limit.plan_id;
                organization_id=limit.organization_id;
                project_id=limit.project_id;
                app_id=limit.app_id;
                UsageDataData.forEach((usage)=>{
                    if(usage.usage_type==limit.limit_type){
                        formattedData[key]={
                            limit:limit.limit_value,
                            usage:usage.usage_value
                        }
                    }
                })
            })

            let current_plan = await Subscription.findOne({
                include : [
                    {
                        model : Invoice
                    }
                ],
                where : {
                    user_id : user_id,
                    status : {
                        [Op.in]:['active','canceled','paused','past_due','expired',"trialing"]
                    },
                    // current_period_end: {
                    //     [Op.gt]: currentTimestampInSeconds
                    // },

                    // plan_id : plan_id,
                    organization_id : organization_id,
                    project_id : project_id,
                    app_id : app_id
                },
                order :[["id","desc"]]
            })

            let invoices = []
            if(current_plan!=null && current_plan.Invoices){
                invoices=current_plan.Invoices;
            }

            let paid_invoice = invoices.filter((invoice) => {
                return invoice.status == "paid"
            })
            let next_billing_cycle = invoices.find((invoice) => {
                return invoice.status == "draft" && invoice.billing_reason == "upcoming"
            })

            let pending_invoice_to_pay = invoices.find((invoice) => {
                return invoice.status == "open" && invoice.billing_reason == "subscription_update"
            })
            let pastDuePlanDetail
            if (pending_invoice_to_pay) {
                let invoice_id = pending_invoice_to_pay.invoice_id
                const invoice_data = await stripe.invoices.retrieve(invoice_id);
                pastDuePlanDetail = invoice_data.subscription_details.metadata
            }else{
                pastDuePlanDetail = null
            }
            let trailPlan = await ProductTrial.findOne({
                where : {
                    user_id : user_id,
                    // plan_id : plan_id,
                    organization_id : organization_id,
                    project_id : project_id,
                    app_id : app_id
                }
            })

            let add_on
            let subscription_id=null
            if (!current_plan) {
                let all_plans = {...config('plan')}
                const plan = all_plans["plans"][`${app_id}`]
                const data = Object.keys(plan).find((data) => {
                    let config_plan_id = plan[`${data}`].plan_id
                    return config_plan_id == plan_id
                })
                plan_name = data
                add_on = null
            }else{
                plan_name = current_plan.plan_name
                subscription_id = current_plan.id
                const subscription_benefits = JSON.parse(current_plan.subscription_benefits)
                add_on = subscription_benefits?.add_on
            }
            let data={
                usage:formattedData,
                plan : plan_name,
                trail_plan:trailPlan,
                subscription_id : subscription_id,
                plan_id : plan_id,
                add_on : add_on,
                next_billing_cycle : next_billing_cycle,
                paid_invoice: paid_invoice,
                status:status,
                subscriptionData:current_plan,
                pastDuePlanDetail : pastDuePlanDetail
            }

            if(trailPlan){
                const time = moment().utc(true).format("YYYY-MM-DD HH:mm:ss")
                const expiry_date = moment(trailPlan.expiry_date).utc(true).format("YYYY-MM-DD HH:mm:ss")

                if (time > expiry_date) {
                    logInfo("plan expired");
                    data.status = "expired";
                }else{
                    data.status = trailPlan.status;
                }
                data.trail_plan = trailPlan
            }

            if(current_plan){
                data.status = current_plan.status;
            }


            // let subscription_benefits = JSON.parse(current_plan.subscription_benefits)

            return res.status(200).send({
                type: "RXSUCCESS",
                message: "usage data",
                data : data
            })

        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong",
            })
        }
    }

    async getActivePlan(req, res) {
        const input = req.body
        let user_id = req.authUser.user_id;
        
        // validate the params
        let result = validateParameters(["project_uid","app_id"], input);

        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }
        
        const data = await Project.findOne({
            where : {
                project_uid : input.project_uid
            }
        })
        if (!data) {
            return res.status(400).send({
                type: "RXERROR",
                message: "project not found",
            }); 
        }
        const permission = await userPrivilege({ type: 'project', searchParam: { user_id: user_id, project_id: data.id }, allowedRole: ['owner', 'editor', 'viewer','operator'], key: input.project_uid })
        logInfo("permission", permission);
        if (permission !== 'valid') {
            return res.status(400).send({
                type: "RXERROR",
                message: permission.message,
            })
        }
        let customWhere = {
            app_id : input.app_id,
            organization_id : data.organization_id
        }

        try {
            let UsageLimitData = await UsageLimit.findAll({
                where : customWhere
            })
            let UsageDataData = await UsageData.findAll({
                where : customWhere
            });

            if(UsageLimitData.length<1){
                return res.status(400).send({
                    type: "RXERROR",
                    message: "data not found",
                }) 
            }

            let formattedData={}
            let plan_id=null;
            let organization_id=null;
            let project_id=null;
            let app_id=null;
            let plan_name=null;
            let status=null;
            UsageLimitData.forEach((limit)=>{
                let key=limit.limit_type;
                plan_id=limit.plan_id;
                organization_id=limit.organization_id;
                project_id=limit.project_id;
                app_id=limit.app_id;
                UsageDataData.forEach((usage)=>{
                    if(usage.usage_type==limit.limit_type){
                        formattedData[key]={
                            limit:limit.limit_value,
                            usage:usage.usage_value
                        }
                    }
                })
            })

            let current_plan = await Subscription.findOne({
                include : [
                    {
                        model : Invoice
                    }
                ],
                where : {
                    status : {
                        [Op.in]:['active','canceled','paused','past_due','expired',"trialing"]
                    },
                    // current_period_end: {
                    //     [Op.gt]: currentTimestampInSeconds
                    // },

                    // plan_id : plan_id,
                    organization_id : organization_id,
                    app_id : app_id
                },
                order :[["id","desc"]]
            })

            let invoices = []
            if(current_plan!=null && current_plan.Invoices){
                invoices=current_plan.Invoices;
            }

            let paid_invoice = invoices.filter((invoice) => {
                return invoice.status == "paid"
            })
            let next_billing_cycle = invoices.find((invoice) => {
                return invoice.status == "draft" && invoice.billing_reason == "upcoming"
            })

            let pending_invoice_to_pay = invoices.find((invoice) => {
                return invoice.status == "open" && invoice.billing_reason == "subscription_update"
            })
            let pastDuePlanDetail
            if (pending_invoice_to_pay) {
                let invoice_id = pending_invoice_to_pay.invoice_id
                const invoice_data = await stripe.invoices.retrieve(
                invoice_id
            );
                pastDuePlanDetail = invoice_data.subscription_details.metadata
            }else{
                pastDuePlanDetail = null
            }
            let trailPlan = await ProductTrial.findOne({
                where : {
                    // plan_id : plan_id,
                    organization_id : organization_id,
                    app_id : app_id
                }
            })

            let add_on
            let subscription_id=null
            if (!current_plan) {
                let all_plans = {...config('plan')}
                const plan = all_plans["plans"][`${app_id}`]
                const data = Object.keys(plan).find((data) => {
                    let config_plan_id = plan[`${data}`].plan_id
                    return config_plan_id == plan_id
                })
                plan_name = data
                add_on = null
            }else{
                plan_name = current_plan.plan_name
                subscription_id = current_plan.id
                const subscription_benefits = JSON.parse(current_plan.subscription_benefits)
                add_on = subscription_benefits?.add_on
            }
            let data={
                usage:formattedData,
                plan : plan_name,
                trail_plan:trailPlan,
                subscription_id : subscription_id,
                plan_id : plan_id,
                add_on : add_on,
                next_billing_cycle : next_billing_cycle,
                paid_invoice: paid_invoice,
                status:status,
                subscriptionData:current_plan,
                pastDuePlanDetail : pastDuePlanDetail
            }

            if(trailPlan){
                const time = moment().utc(true).format("YYYY-MM-DD HH:mm:ss")
                const expiry_date = moment(trailPlan.expiry_date).utc(true).format("YYYY-MM-DD HH:mm:ss")

                if (time > expiry_date) {
                    logInfo("plan expired");
                    data.status = "expired";
                }else{
                    data.status = trailPlan.status;
                }
                data.trail_plan = trailPlan
            }

            if(current_plan){
                data.status = current_plan.status;
            }

            return res.status(200).send({
                type: "RXSUCCESS",
                message: "usage data",
                data : data
            })

        } catch (error) {
            logInfo(error);
            return res.status(400).send({
                type: "RXERROR",
                message: "Something went wrong",
            })
        }
    }

    async updateBenefitsForChangePlan(req, res) {
        
        let ActiveSubscriptions = await Subscription.findAll({
            where : {
                status : "active",
                app_id : 1
            }
        })
        let data=[];
        let all_plans = {...config('plan')}
        for(let key in ActiveSubscriptions){
            let subscription = ActiveSubscriptions[key]
            let updatedPlan  = {
                id : subscription.id,
                subscription_id : subscription.subscription_id,
                plan_id : subscription.plan_id,
                credits : all_plans["plans"][1][`${subscription.plan_name}`].credits, 
            };
            let subscription_benefits = JSON.parse(subscription.subscription_benefits);

            // "add_on":[{"name":"query_credit_addon","quantity":"5"}]
            if(subscription_benefits?.add_on){
                let add_on = subscription_benefits?.add_on;
                let add_on_data = [];
                for(let key in add_on){
                    let add_on_item = add_on[key];
                  
                    let add_on_plan = all_plans["plans"][1]["chat_bot_add_on"][`${add_on_item.name}`];
                    add_on_data.push({
                        name : add_on_item.name,
                        quantity : add_on_item.quantity,
                        credits : add_on_plan.credits
                    })
                    
                    if(!add_on_item.name.includes("credit")){
                        continue
                    }

                    if(updatedPlan["credits"].toString().split("/").length > 1){
                        updatedPlan["credits"] = (+updatedPlan["credits"].toString().split("/")[0] + add_on_plan.credits * +add_on_item.quantity)+"/∞";
                    }else{
                        updatedPlan["credits"] = updatedPlan["credits"] + add_on_plan.credits * +add_on_item.quantity;
                    }
                 
                    
                    // updated subscription
                    let updateSubscription=subscription_benefits;
                    updateSubscription["credits"] = updatedPlan["credits"];
                    
                    await Subscription.update({ subscription_benefits : JSON.stringify(updateSubscription) },{where : { id : subscription.id}});    
                }
                updatedPlan["add_on"] = add_on_data;
            }

            function toMillion(num) {
                return (num.toString().split("/").length>0? +num.toString().split("/")[0]/1000000: num/1000000)+" Million";
            }
            updatedPlan["credits_in_m"] = toMillion(updatedPlan["credits"]);
            updatedPlan["plan"]=subscription.plan_name
            updatedPlan["organization_id"]=subscription.organization_id;

            await UsageLimit.update({  limit_value : updatedPlan["credits"]  },{
                where : {
                    app_id : 1,
                    organization_id : subscription.organization_id,
                    limit_type : "credits"
                }
            })

            data.push(updatedPlan)
        }

        // // cross validate the credits, if not correct then put to array
        // for(let key in data){
        //     let subscription = data[key];
        //     let credits = subscription.credits;
        //     let add_on = subscription.add_on;
        //     let add_on_credits = 2500000;
        //     let total_credits =  config('plan')["plans"][1][`${subscription.plan}`]["credits"]
        //     for(let key in add_on){
        //         let add_on_item = add_on[key];
        //         if(add_on_item.name.includes("credit")){
        //             add_on_credits = add_on_credits * +add_on_item.quantity;
        //             total_credits = total_credits + add_on_credits;
        //         }
        //     }
        //     if(data[key]["credits"] != total_credits){
        //         logInfo("not matched",subscription)
        //     }else{
        //         logInfo(" matched",data[key]["credits"],total_credits)
        //     }
        // }

        return res.send(data)
    }

    async clearPlanDataByOrganization(req,res){
        let input = req.body
        let user_id = req.authUser.user_id;
        // validate the params
        let result = validateParameters(["organization_id","app_id"], input);
    
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }

        await Subscription.destroy({
            where : {
                organization_id : input.organization_id,
                app_id : input.app_id,
            }
        })
        await UsageLimit.destroy({
            where : {
                organization_id : input.organization_id,
                app_id : input.app_id,
            }
        })
        await UsageData.destroy({
            where : {
                organization_id : input.organization_id,
                app_id : input.app_id,
            }
        })
        await ProductTrial.destroy({
            where : {
                organization_id : input.organization_id,
                app_id : input.app_id,
            }
        });

        let organization = await Organization.create({
            name : "test_subscription",
            created_by : user_id
        });

        let organization_id = organization.id;

        await OrganizationMember.create({
            organization_id: organization_id,
            user_id : user_id,
            role : "owner"
        });

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data cleared successfully",
            data : {
                organization_id : organization_id
            }
        });
    }

    async clearPlanData(req,res){
        let input = req.body
        // validate the params
        let result = validateParameters(["subscription_id"], input);
    
        if (result != 'valid') {
            let error = formatJoiError(result.errors);
            return res.status(400).send({
              type: "RXERROR",
              message: "Invalid params",
              errors: error
            });
        }
        let subc = await Subscription.findOne({
            where : {
                id : input.subscription_id
            }
        })
        if (!subc) {
            return res.status(400).send({
                type: "RXERROR",
                message: "Subscription not found",
            });
        }

        await Subscription.destroy({
            where : {
                id : input.subscription_id
            }
        })
        await UsageLimit.destroy({
            where : {
                organization_id : subc.organization_id,
                app_id : subc.app_id,
            }
        })
        await UsageData.destroy({
            where : {
                organization_id : subc.organization_id,
                app_id : subc.app_id,
            }
        })
        await ProductTrial.destroy({
            where : {
                organization_id : subc.organization_id,
                app_id : subc.app_id,
            }
        });

        return res.status(200).send({
            type: "RXSUCCESS",
            message: "Data cleared successfully"
        });
    }

}

async function paddleSubscriptionCreated(object) {
    let plan_name = object.custom_data.plan_name;
    let app_id = object.custom_data.app_id;
    let app_plans = {...config('plan')};
    let plan = {...app_plans.plans[app_id][plan_name]};

    let plan_id = plan.plan_id;
    let items = object.items;
    let add_on = null;
    if(object.custom_data?.add_on) add_on = JSON.parse(object.custom_data.add_on);
    let add_on_item = [];

    if(add_on && add_on.length > 0){
        for(let i=0; i<add_on.length; i++){
            if(app_plans.plans[app_id]["chat_bot_add_on"][add_on[i].name]){
                let find_add_on = items.find((item2)=>{
                    return item2.price.id === app_plans.plans[app_id]["chat_bot_add_on"][add_on[i].name]["paddle_plan_id"]
                });
                if(find_add_on){
                    add_on_item.push({ name: add_on[i].name, quantity: find_add_on.quantity });
                }
            }
        }
    }

    if(add_on_item && add_on_item.length > 0){
        for (let i = 0; i < add_on_item.length; i++) {
            let item = add_on_item[i];
            let add_on_plan = app_plans.plans[app_id]["chat_bot_add_on"][item.name];
    
            let purpose = add_on_plan.purpose
    
                for (let k = 0; k < purpose.length; k++) {
                    const purpose_item = purpose[k];
                    if (typeof plan[purpose_item] != "undefined") {
                        const regex = /^(\d+)\/∞$/;
                        if (regex.test(plan[purpose_item])) {
                            plan[purpose_item] = `${Number(plan[purpose_item].split('/')[0]) + add_on_plan[purpose_item] * item.quantity}` + "/" + "∞"
                        }else if(plan[purpose_item] == "∞"){
                            plan[purpose_item] = plan[purpose_item]
                        }else{
                            plan[purpose_item] = plan[purpose_item] + add_on_plan[purpose_item] * item.quantity
                        }
                    }
                };
        };
    };

    let gateway_plan_id = object.items[0].price.id;
    delete plan.inr_stripe_plan_id;
    delete plan.stripe_plan_id;
    delete plan.successUrl;
    delete plan.cancelUrl;

    let subscription_benefits = JSON.stringify({ ...plan, add_on: add_on_item && add_on_item.length > 0 ? add_on_item : null});
    let data = await Subscription.findOrCreate({
        where : {subscription_id: object.id},
        defaults :{
        status : object.status,
        subscription_id:object.id,
        currency:object.currency_code,
        current_period_end: getUnixTime(object.current_billing_period.ends_at),
        current_period_start: getUnixTime(object.current_billing_period.starts_at),
        customer_id:object.customer_id,
        status:object.status,
        user_id : object.custom_data.user_id,
        collection_method: "paddle",
        plan_id : plan_id,
        project_id:object.custom_data.project_id,
        app_id:object.custom_data?.app_id,
        organization_id:object.custom_data?.organization_id,
        plan_name : object.custom_data.plan_name,
        subscription_benefits : subscription_benefits,
        gateway_plan_id: gateway_plan_id,
    }});

    if(object.custom_data.add_on) delete object.custom_data.add_on;
    if(object.custom_data.subscription_benefits) delete object.custom_data.subscription_benefits;

    let custom_data = {
        ...object.custom_data,
        add_on : JSON.stringify(add_on_item),
        subscription_benefits: subscription_benefits
    };


    await paddle.subscriptions.update(object.id, {
        customData: custom_data
    });

    return subscription_benefits;
};


async function subscriptionCreated(object) {
    let subscription_benefits = {}
    if (object.metadata.add_on) {
        subscription_benefits = JSON.stringify({...JSON.parse(object.metadata.subscription_benefits),...{add_on : JSON.parse(object.metadata.add_on)}})
        
    }else{
        subscription_benefits = JSON.stringify(JSON.parse(object.metadata.subscription_benefits))
    }
    const plan_id = object.items.data[0].plan.id
    const data = await Subscription.findOrCreate({
            where : {subscription_id: object.id},
            defaults :{
            status : object.status,
            subscription_id:object.id,
            created:object.created,
            currency:object.currency,
            current_period_end:object.current_period_end,
            current_period_start:object.current_period_start,
            customer_id:object.customer,
            status:object.status,
            user_id : object.metadata.user_id,
            collection_method:object.collection_method,
            plan_id : object.metadata.plan_id,
            project_id:object.metadata.project_id,
            app_id:object.metadata?.app_id,
            organization_id:object.metadata?.organization_id,
            plan_name : object.metadata?.plan_name,
            subscription_benefits : subscription_benefits,
            gateway_plan_id:plan_id,
        }})
    return data
}

async function getSubscriptionById(object) {
    
      const data = await Subscription.findOne({
        where:{
            subscription_id : object
        }
      })
      if (data) {
        logInfo("LOG 1 subscription_created",object);
        if (data?.status == "trialing") {
            return true
        } else if(data?.status != "active") {
            await sendEmailNotification("subscription_created",data.user_id,{subscription_id : data.subscription_id})
            return await Subscription.update({status : "active"},{
                where : {
                    subscription_id : object
                }
            })
        }
      }

      const subscription = await stripe.subscriptions.retrieve(
        object
      );

      if (!data) {
        let subscription_benefits = subscription.metadata?.subscription_benefits
        if (subscription.metadata.add_on) {
            subscription_benefits = JSON.stringify({...JSON.parse(subscription.metadata.subscription_benefits),...{add_on : JSON.parse(subscription.metadata.add_on)}})
        }
        const subscriptionData = await Subscription.create({
                subscription_id:subscription.id,
                created:subscription.created,
                currency:subscription.currency,
                current_period_end:subscription.current_period_end,
                current_period_start:subscription.current_period_start,
                customer_id:subscription.customer,
                status:subscription.status,
                user_id : subscription.metadata.user_id,
                collection_method:subscription.collection_method,
                plan_id : subscription.metadata.plan_id,
                user_id:subscription.metadata.user_id,
                project_id:subscription.metadata.project_id,
                app_id:subscription.metadata?.app_id,
                organization_id:subscription.metadata?.organization_id,
                plan_name : subscription.metadata?.plan_name,
                subscription_benefits : subscription_benefits,
                gateway_plan_id:subscription?.plan?.id ? subscription?.plan?.id : subscription.items.data[0].plan.id,
                cancel_at:subscription.cancel_at,
                canceled_at:subscription.canceled_at,
                cancel_at_period_end:subscription.cancel_at_period_end
        })
        logInfo("LOG 2 subscription_created");
        await sendEmailNotification("subscription_created",subscriptionData.user_id,{subscription_id : subscriptionData.subscription_id})
        return 0
      }
      return 0
}

async function subscriptionUpdate(subscription_id,object) {
    const data = await Subscription.update(object,{
        where : {subscription_id : subscription_id}
    });
    
    return data;
}

async function invoiceCreate(object) {
    const subscription = await Subscription.findOne({
        include : [
            {
                model :Invoice
            } 
        ],
        where : {
            subscription_id : object.subscription
        }
    })
    const subscription_id = subscription?.id
    const invoice_data = subscription?.Invoices.find(item => object.id == item.invoice_id)
    if (invoice_data) {
        await Invoice.update({
            status : object.status,
                invoice_id:object.id,
                amount_due:object.amount_due,
                amount_paid:object.amount_paid,
                amount_remaining:object.amount_remaining,
                created:object.created,
                currency:object.currency,
                customer_id:object.customer,
                transaction_id:object.charge,
                customer_email:object.customer_email,
                customer_name:object.customer_name,
                product_id:object.product_id,
                plan_id:object.plan_id,
                subscription_id:subscription_id,
                payment_intent:object.payment_intent,
                total:object.total,
                subtotal:object.subtotal,
                invoice_pdf : object.invoice_pdf,
                hosted_invoice_url : object.hosted_invoice_url,
                app_id : object.subscription_details.metadata?.app_id,
                organization_id: object.subscription_details.metadata?.organization_id,
                due_date : object.due_date,
                paid : object.paid,
                period_end : object.period_end,
                period_start : object.period_start,
                billing_reason : object.billing_reason,
        },{
            where : {
                invoice_id : object.id
            }
        })
    }else{
        const data = await Invoice.create(
            {
                status : object.status,
                invoice_id:object.id,
                amount_due:object.amount_due,
                amount_paid:object.amount_paid,
                amount_remaining:object.amount_remaining,
                created:object.created,
                currency:object.currency,
                customer_id:object.customer,
                transaction_id:object.charge,
                customer_email:object.customer_email,
                customer_name:object.customer_name,
                product_id:object.product_id,
                plan_id:object.plan_id,
                subscription_id:subscription_id,
                payment_intent:object.payment_intent,
                total:object.total,
                subtotal:object.subtotal,
                invoice_pdf : object.invoice_pdf,
                hosted_invoice_url : object.hosted_invoice_url,
                app_id : object.subscription_details.metadata?.app_id,
                organization_id: object.subscription_details.metadata?.organization_id,
                due_date : object.due_date,
                paid : object.paid,
                period_end : object.period_end,
                period_start : object.period_start,
                billing_reason : object.billing_reason,
            })
    }
    
    return 0
}

async function chargeCreate(object) {
    const invoice_id = object.invoice
    const invoice = await stripe.invoices.retrieve(
        invoice_id
    )
    const subscription_id = invoice.subscription
    const subscription = await Subscription.findOne({
        where : {
            subscription_id : subscription_id
        }
    })
    if (!subscription) return 0
    
    const data = await Transaction.create(
        {
            status : object.status,
            transaction_id:object.id,
            amount:object.amount,
            created : object.created,
            amount_captured:object.amount_captured,
            amount_refunded:object.amount_refunded,
            currency:object.currency,
            subscription_id:subscription.id
        })
    return 0
}

async function discountSubscriptionCreate(object) {

    const subscription = await Subscription.findOne({
        where : {
            subscription_id : object.subscription
        }
    })
    const subscription_id = subscription.id
    const invoice = await Invoice.findOne({
        where : {
            invoice_id : object.id,
            status : "paid"
        }
    })
    const invoice_id = invoice.id;
    const data = await DiscountSubscription.create(
        {
            subscription_id : subscription_id,
            coupon_id : object.discount.coupon.id,
            percent_off : object.discount.coupon.percent_off, 
            promotion_code:object.discount.promotion_code,
            invoice_id : invoice_id
        })
    return data
}

async function usageLimit(subscription_id, type){
    
    let data1 = null;
    let plan_benefits = null;
    let project_id = null;
    let organization_id = null;
    let app_id = null;

    switch(type){
        case "paddle" : 

        data1 = await Subscription.findOne({ where : {subscription_id: subscription_id} });
        if(data1 && data1.subscription_benefits){
            let benifits_data = JSON.parse(data1.subscription_benefits);
            let add_on = benifits_data?.add_on && benifits_data?.add_on.length > 0  ? benifits_data.add_on : undefined;
            delete benifits_data.add_on;
            plan_benefits = ({ ...(benifits_data), add_on: add_on});
            plan_benefits = JSON.stringify(plan_benefits);
            break;
        }
        else return 0;

        default : 
        data1 = await await stripe.subscriptions.retrieve(subscription_id);
        data1 = data1.metadata;
        plan_benefits = JSON.stringify({ ...JSON.parse(data1.subscription_benefits), add_on: data1?.add_on ? JSON.parse(data1.add_on) : undefined})

            break;

    }

    project_id = typeof data1?.project_id == "undefined" ? null : data1.project_id;
    organization_id = data1.organization_id;
    app_id = data1.app_id;
    plan_id = data1.plan_id

    let customWhere
    if (project_id) {
        customWhere = {
            project_id:project_id,
            app_id:app_id
        }
    }else if(organization_id) {
        customWhere = {
            organization_id:organization_id,
            app_id:app_id
        }
    }
    const usage = await UsageLimit.findAll({
        where : customWhere
    });
    let all_plans = {...config('plan')}
    const plan = all_plans["plans"][`${app_id}`]
    const plan_name = Object.keys(plan).find((data) => {
        let config_plan_id = plan[`${data}`].plan_id
        return config_plan_id == plan_id
    })
    const searchBy = data1?.User?.email

    const updateChatBotCount = await updateBrevoContact({chatbot_plan:`${plan_name}`},searchBy)
    if (usage.length > 0) {
        return updateUsageLimitbyAppId(app_id,project_id,organization_id,plan_benefits)
    }

    return usageLimitbyAppId(app_id,project_id,organization_id,plan_benefits)
}

async function usageData(subscription_id, type){

    let data1 = null;
    let plan_benefits = null;
    let project_id = null;
    let organization_id = null;
    let app_id = null;

    switch(type){
        case "paddle" : 

        data1 = await Subscription.findOne({ where : {subscription_id: subscription_id} });
        if(data1 && data1.subscription_benefits){
            let benifits_data = JSON.parse(data1.subscription_benefits);
            let add_on = benifits_data?.add_on && benifits_data?.add_on.length > 0  ? benifits_data.add_on : undefined;
            delete benifits_data.add_on;
            plan_benefits = ({ ...(benifits_data), add_on: add_on});
            plan_benefits = JSON.stringify(plan_benefits);
            break;
        }
        else return 0;

        default : 
        data1 = await await stripe.subscriptions.retrieve(subscription_id);
        data1 = data1.metadata;
        plan_benefits = JSON.stringify({ ...JSON.parse(data1.subscription_benefits), add_on: data1?.add_on ? JSON.parse(data1.add_on) : undefined})

            break;

    }

    let customWhere
    project_id = typeof data1?.project_id == "undefined" ? null : data1.project_id;
    organization_id = data1?.organization_id;
    app_id = data1.app_id;

    if (project_id) {
        customWhere = {
            project_id:project_id,
            app_id:app_id
        }
    }else if(organization_id) {
        customWhere = {
            organization_id:organization_id,
            app_id:app_id
        }
    }
    const usage = await UsageData.findAll({
        where : customWhere
    })

    if (usage.length > 0) {
        return updateUsageDatabyAppId(app_id,project_id,organization_id,plan_benefits)
    }
    return  usageDatabyAppId(app_id,project_id,organization_id,plan_benefits)
}


async function usageLimitbyAppId(app_id,project_id,organization_id,plan_benefits) {
    logInfo("usageLimitbyAppId",{app_id,project_id,organization_id,plan_benefits});
    const benefits = JSON.parse(plan_benefits)
    const plan_id = benefits.plan_id
    const features = benefits.features
    const arr = Object.keys(benefits)
    for (let i = 0; i < arr.length; i++) {
        if(features.includes(arr[i])){
            await UsageLimit.create({
                plan_id : plan_id,
                app_id:app_id,
                project_id:project_id,
                organization_id:organization_id,
                limit_type : arr[i],
                limit_value : benefits[arr[i]]
            })
        }
        
    }
    
    let add_on
    let plan_app_id = Number(app_id)
    switch (plan_app_id) {
        case 1:
            add_on =  "chat_bot_add_on"
            break;
        case 2:
            add_on =  "qa_add_on"
            break;
    
        default:
            return 0
            break;
    }
    
    let app_plans = config('plan');
    let plans = app_plans.plans[app_id];
    let add_on_data = benefits?.add_on
    logInfo("add_on_data",add_on_data);
    if (Array.isArray(add_on_data)) {
        for (let j = 0; j < add_on_data.length; j++) {
            let add_on_plan = plans[`${add_on}`][`${add_on_data[j].name}`]
            logInfo("add_on_plan",add_on_plan);
            let purpose = add_on_plan.purpose
            for (let k = 0; k < purpose.length; k++) {
                let usage_limit = await UsageLimit.findOne({
                    where : {
                        app_id : app_id,
                        organization_id : organization_id,
                        limit_type : purpose[k]
                    }
                })
                if (!usage_limit) {
                    await UsageLimit.create({
                        app_id : app_id,
                        organization_id : organization_id,
                        plan_id : plan_id,
                        limit_type : purpose[k],
                        limit_value : add_on_plan[purpose[k]] * add_on_data[j].quantity
                    })
                }
                let usage_data = await UsageData.findOne({
                    where : {
                        app_id : app_id,
                        organization_id : organization_id,
                        usage_type : purpose[k]
                    }
                })
                if (!usage_data) {
                    await UsageData.create({
                        app_id : app_id,
                        organization_id : organization_id,
                        plan_id : plan_id,
                        usage_type : purpose[k],
                        usage_value : 0
                    })
                }
                
            }
        }
    }
}

async function usageDatabyAppId(app_id,project_id,organization_id,plan_benefits) {
    logInfo("usageDatabyAppId",{app_id,project_id,organization_id,plan_benefits});
    const benefits = JSON.parse(plan_benefits)
    const plan_id = benefits.plan_id
    const features = benefits.features
    const arr = Object.keys(benefits)
    for (let i = 0; i < arr.length; i++) {
        if(features.includes(arr[i])){
            await UsageData.create({
                plan_id : plan_id,
                app_id:app_id,
                project_id:project_id,
                organization_id:organization_id,
                usage_type : arr[i],
                usage_value : 0
            })
        }
        
    }
    logInfo(typeof app_id);
    let add_on
    let plan_app_id = Number(app_id)
    switch (plan_app_id) {
        case 1:
            add_on =  "chat_bot_add_on"
            break;
        case 2:
            add_on =  "qa_add_on"
            break;
    
        default:
            return 0
            break;
    }
    let app_plans = {...config('plan')};
    let plans = app_plans.plans[app_id];
    let add_on_data = benefits?.add_on
    if (Array.isArray(add_on_data)) {
        for (let j = 0; j < add_on_data.length; j++) {
            let add_on_plan = plans[`${add_on}`][`${add_on_data[j].name}`]
            let purpose = add_on_plan.purpose
            for (let k = 0; k < purpose.length; k++) {
                let data = await UsageData.findOne({
                    where : {
                        app_id : app_id,
                        organization_id : organization_id,
                        usage_type : purpose[k]
                    }
                })
                if (!data) {
                    await UsageData.create({
                        app_id : app_id,
                        organization_id : organization_id,
                        plan_id : plan_id,
                        usage_type : purpose[k],
                        usage_value : 0
                    })
                }
                
            }
        }
    }
}

async function updateUsageDatabyAppId(app_id,project_id,organization_id,plan_benefits) {
    logInfo("updateUsageDatabyAppId",{app_id,project_id,organization_id,plan_benefits});
    const benefits = JSON.parse(plan_benefits)
    const plan_id = benefits.plan_id
    const features = benefits.features
    Object.keys(benefits).forEach(async (i)=>{
        if(features.includes(i)){
            if (i == "credits" || i=="voice_credits" || i=="characters" ) {
                await UsageData.update({plan_id : plan_id,usage_value : 0},{
                    where : {
                        usage_type : i,
                        app_id:app_id,
                        project_id:project_id,
                        organization_id:organization_id,
                    }
                })
            }
            await UsageData.update({plan_id : plan_id},{
                where : {
                    usage_type : i,
                    app_id:app_id,
                    project_id:project_id,
                    organization_id:organization_id,
                }
            })
        }
    })
    logInfo(typeof app_id);
    let add_on
    let plan_app_id = Number(app_id)
    switch (plan_app_id) {
        case 1:
            add_on =  "chat_bot_add_on"
            break;
        case 2:
            add_on =  "qa_add_on"
            break;
    
        default:
            break;
    }
    let app_plans = {...config('plan')};
    let plans = app_plans.plans[app_id];
    let add_on_data = benefits?.add_on
    logInfo("add_on_data",add_on_data);
    if (Array.isArray(add_on_data)) {
        for (let j = 0; j < add_on_data.length; j++) {
            let add_on_plan = plans[`${add_on}`][`${add_on_data[j].name}`]
            logInfo("add_on_plan",add_on_plan);
            let purpose = add_on_plan.purpose
            for (let k = 0; k < purpose.length; k++) {
                if(!features.includes(purpose[k]) && purpose[k] == "voice_credits"){
                    let usage_data = await UsageData.findOne({
                        where : {
                            app_id : app_id,
                            organization_id : organization_id,
                            usage_type : purpose[k]
                        }
                    })
                    if (!usage_data) {
                        await UsageData.create({
                            app_id : app_id,
                            organization_id : organization_id,
                            plan_id : plan_id,
                            usage_type : purpose[k],
                            usage_value : 0
                        })
                    }else{
                        await UsageData.update({
                                plan_id : plan_id,
                                usage_value : 0
                            },{
                            where : {
                                app_id : app_id,
                                organization_id : organization_id,
                                usage_type : purpose[k],
                            }
                        })
                    }
                }
            }
        }
    }

}

async function updateUsageLimitbyAppId(app_id,project_id,organization_id,plan_benefits) {
    logInfo("updateUsageLimitbyAppId",{app_id,project_id,organization_id,plan_benefits});
    const projectTrialData = await ProductTrial.findOne({
        include : [
           { model : User,as:"user"}
        ],
        where : {
            app_id:app_id,
            project_id:project_id,
            organization_id:organization_id,
            status : "free_trial"
        }
    })
    if (projectTrialData) {
        await ProductTrial.update({status : "upgraded"},{
            where : {
                app_id:app_id,
                project_id:project_id,
                organization_id:organization_id,
            }
        })

        const searchBy = projectTrialData.user.email
        const brevo_expiry_date = moment().add(7,"days").format("YYYY-MM-DD");
        let updatedData = {}
        switch (app_id) {
            case 1:
                updatedData = {CHATBOT_TRAIL_EXPIRY : brevo_expiry_date , CHATBOT_TRAIL_STATUS : "Upgraded"}
                break;
            case 2:
                updatedData = {QAMASTER_TRAIL_EXPIRY : brevo_expiry_date,QAMASTER_TRAIL_STATUS : "Upgraded"}
                break;
        
            default:
                break;
        }
        await updateBrevoContact(updatedData,searchBy)
    }
    const benefits = JSON.parse(plan_benefits)
    const plan_id = benefits.plan_id
    const features = benefits.features
    let arr = Object.keys(benefits);

    let usage_limit = await UsageLimit.findAll({where : {app_id:app_id,organization_id:organization_id}});
    usage_limit = JSON.parse(JSON.stringify(usage_limit));

    let pre_limit_type = usage_limit.map((item)=>{ return item.limit_type });
    let new_limit_type = arr.filter((item)=> { return !pre_limit_type.includes(item) && features.includes(item) });

    if(new_limit_type.length > 0){
        for (let j = 0; j < new_limit_type.length; j++) {
            await UsageLimit.create({
                plan_id : plan_id,
                limit_value : benefits[new_limit_type[j]],
                limit_type : new_limit_type[j],
                app_id:app_id,
                project_id:project_id,
                organization_id:organization_id,
            });

            await UsageData.create({
                plan_id : plan_id,
                usage_value : 0,
                usage_type : new_limit_type[j],
                app_id:app_id,
                project_id:project_id,
                organization_id:organization_id,
            })
        }
    };

    for (let i = 0; i < arr.length; i++) {
        if(features.includes(arr[i])){
            logInfo("prev",i,benefits[arr[i]]);
            await UsageLimit.update({plan_id : plan_id,limit_value : benefits[arr[i]]},{
                 where : {
                     limit_type : arr[i],
                     app_id:app_id,
                     project_id:project_id,
                     organization_id:organization_id,
                 }
            })
         }
    }
    logInfo(typeof app_id);
    let add_on
    let plan_app_id = Number(app_id)
    switch (plan_app_id) {
        case 1:
            add_on =  "chat_bot_add_on"
            break;
        case 2:
            add_on =  "qa_add_on"
            break;
    
        default:
            break;
    }
    let app_plans = {...config('plan')};
    let plans = app_plans.plans[app_id];
    let add_on_data = benefits?.add_on
    logInfo("add_on_data",add_on_data);
    if (Array.isArray(add_on_data)) {
        for (let j = 0; j < add_on_data.length; j++) {
            let add_on_plan = plans[`${add_on}`][`${add_on_data[j].name}`]
            logInfo("add_on_plan",add_on_plan);
            let purpose = add_on_plan.purpose
            arr = [...arr,...purpose]
            for (let k = 0; k < purpose.length; k++) {
                if(!features.includes(purpose[k])){
                    let usage_data = await UsageData.findOne({
                        where : {
                            app_id : app_id,
                            organization_id : organization_id,
                            usage_type : purpose[k]
                        }
                    })
                    if (!usage_data) {
                        await UsageData.create({
                            app_id : app_id,
                            organization_id : organization_id,
                            plan_id : plan_id,
                            usage_type : purpose[k],
                            usage_value : 0
                        })
                    }else{
                        await UsageData.update({
                                plan_id : plan_id,
                            },{
                            where : {
                                app_id : app_id,
                                organization_id : organization_id,
                                usage_type : purpose[k],
                            }
                        })
                    }
                    let limit_data = await UsageLimit.findOne({
                        where : {
                            app_id : app_id,
                            organization_id : organization_id,
                            limit_type : purpose[k]
                        }
                    })
                    if (!limit_data) {
                        await UsageLimit.create({
                            app_id : app_id,
                            organization_id : organization_id,
                            plan_id : plan_id,
                            limit_type : purpose[k],
                            limit_value : add_on_plan[purpose[k]] * add_on_data[j].quantity
                        })
                    }else{
                        await UsageLimit.update({
                            plan_id : plan_id,
                            limit_value : add_on_plan[purpose[k]] * add_on_data[j].quantity
                            },{
                            where : {
                                app_id : app_id,
                                organization_id : organization_id,
                                limit_type : purpose[k]
                            }
                        })
                    }
                }
            }
        }
    }
    await UsageData.update({plan_id : plan_id,limit_value : 0},{
        where : {
            app_id : app_id,
            organization_id : organization_id,
            usage_type : {
                [Op.notIn]:arr
            }
        }
    })
    await UsageLimit.update({plan_id : plan_id,limit_value : 0},{
        where : {
            app_id : app_id,
            organization_id : organization_id,
            limit_type : {
                [Op.notIn]:arr
            }
        }
    })
    // Object.keys(benefits).forEach(async (i)=>{
    //     if(features.includes(i)){
    //        await UsageLimit.update({plan_id : plan_id,limit_value : benefits[i]},{
    //             where : {
    //                 limit_type : i,
    //                 app_id:app_id,
    //                 project_id:project_id,
    //                 organization_id:organization_id,
    //             }
    //        })
    //     }
    // })
}

function paymentRedirectionUrl(type,plan,data) {
    return new Promise((res,rej) => {
        let url=""
        if(type=="success"){
            url = plan.successUrl
        }else{
            url = plan.cancelUrl
        }

        Object.keys(data).forEach(function(key){
            let formatUrl=url.replace("@"+key,data[key])
            url=formatUrl;
        })
        res(url)
    })
}

async function createInvoiceLineItems(data,invoice_id) {
    
    data.forEach(async (item) => {
        const subscription = await Subscription.findOne({
            where : {
                subscription_id : item.subscription
            }
        })
        await InvoiceLineItem.create({
            invoice_id: invoice_id,
            amount : item.amount,
            amount_excluding_tax:item.amount_excluding_tax,
            currency:item.currency,
            description:item.description,
            period_end:item.period.end,
            period_start:item.period.start,
            subscription_id:subscription.id,
        })
    })
}

async function getUpcomingInvoice(object,type) {

    const subscription = await Subscription.findOne({
        where : {
            subscription_id : object.subscription
        }
    })
    if (!subscription) {
        return 0
    }

    const invoice = await stripe.invoices.retrieveUpcoming({
        customer: object.customer,
        subscription : object.subscription
    });
    if(typeof invoice.amount_due=="undefined"){
        return 0
    }

    const data = await Invoice.findOne({
        where : {
            subscription_id : subscription.id,
            status : "draft",
        },
    })

    if (data) {
        await Invoice.update({
            amount_due: invoice.amount_due,
            amount_paid:invoice.amount_paid,
            amount_remaining : invoice.amount_remaining,
            created:invoice.created,
            period_start : invoice.period_start,
            period_end : invoice.period_end,
            billing_reason : invoice.billing_reason,
            currency:invoice.currency,
            total:invoice.total,
            subtotal:invoice.subtotal,
            paid : invoice.paid,
            app_id:subscription.app_id,
            organization_id:subscription.organization_id,
        },{
            where : {
                subscription_id : `${subscription.id}`,
                status : "draft",
            }
        })
        return 0
    }
    await Invoice.create({
        amount_due: invoice.amount_due,
        amount_paid:invoice.amount_paid,
        amount_remaining : invoice.amount_remaining,
        created:invoice.created,
        period_start : invoice.period_start,
        period_end : invoice.period_end,
        billing_reason : invoice.billing_reason,
        currency:invoice.currency,
        customer_id:invoice.customer,
        transaction_id:invoice.charge,
        customer_email:invoice.customer_email,
        customer_name:invoice.customer_name,
        subscription_id:subscription.id,
        status:invoice.status,
        payment_intent:invoice.payment_intent,
        total:invoice.total,
        subtotal:invoice.subtotal,
        invoice_pdf:invoice.invoice_pdf,
        hosted_invoice_url : object.hosted_invoice_url,
        app_id:subscription.app_id,
        organization_id:subscription.organization_id,
        due_date : invoice.due_date,
        paid : invoice.paid,
    })

    return 0
}


async function setThriveReferral(object) {

    const SubscriptionData = await Subscription.findOne({
        include : [
            {
                model : User
            },
            {
                model : Invoice,
                where : {
                    status : "paid"
                }
            }
        ],
        where : {
            subscription_id : object
        }
    })

    let key = `${SubscriptionData.organization_id}`; // Project key
    let email_id = SubscriptionData.User.email  // email address of the member.
    let user_id = SubscriptionData.user_id
    let customer_id = SubscriptionData.customer_id
    let digestRaw = email_id+customer_id
    let algorithm = "sha256"
    let digest = crypto.createHmac(algorithm, key).update(digestRaw).digest("hex")

    const { refresh_token,client_id,client_secret,grant_type } = config("zoho")
    const settingData = await Setting.findOne({
        where : {
            key : "thrive"
        }
    })

    let { expires_in , access_token } = JSON.parse(settingData.value)
    const expired = expires_in <= moment().format("YYYY-MM-DD HH:mm:ss")

    if (expired) {
        fetch(`https://accounts.zoho.in/oauth/v2/token?refresh_token=${refresh_token}&client_id=${client_id}&client_secret=${client_secret}&grant_type=${grant_type}`,{
        method : "POST",
        // headers : {
        //     'Content-Type' : 'application/json'
        // }
        }).then(response => {
            if (!response.ok) {
                logInfo('status1:', response.status);
                logInfo('statusText1:', response.statusText);
                logInfo('user_id:', user_id);
            }
            return response.json();
        })
        .then(async(data )=> {
            logInfo('Response1:', data);
            access_token = data.access_token
            const expires_in = moment().add(30, "minutes").format("YYYY-MM-DD HH:mm:ss")
            const value = JSON.stringify({"access_token":access_token,"expires_in" :expires_in})
            await Setting.update({value : value},{
                where : {
                    key : "thrive"
                }
            })
        })
        .catch(error => {
            console.error('Error1 occurred:', error);
            logInfo('user_id:', user_id);
        });
    }
    

    let widget_code = "63af017b75ef5db4c4e5167777e84f206fe0e07a6b96f964d73e390a898cde9c"
    const  thrive_digest = digest
    const body = JSON.stringify({
        "email": email_id,
        "zt_customer_id": SubscriptionData.user_id,
        "thrive_digest" : thrive_digest,
        "amount": SubscriptionData.Invoices.amount_paid,
        "order_id": SubscriptionData.id
    })

    fetch(`https://thrive.zoho.com/thrive-publicapi/widget/${widget_code}/purchase`,{
        method : "POST",
        headers : {
            'Authorization': `${access_token}`,
            'Content-Type' : 'application/json'
        },
        body : body
    }).then(response => {
        if (!response.ok) {
            logInfo('status:', response.status);
            logInfo('statusText:', response.statusText);
            logInfo('user_id:', user_id);
        }
        return response.text();
    })
    .then(async(data )=> {
    logInfo('Response:', data);
    
    })
    .catch(error => {
    console.error('Error occurred:', error);
    logInfo('user_id:', user_id);
    });
}

async function brevoUpdate(object, type) {

    let user_id = null;
    let app_id = null;
    let updatedData = {}

    switch(type){
        case "paddle" : 
        user_id = object.custom_data.user_id
        app_id = object.custom_data.app_id
            break;
        default : 
        user_id = object.metadata.user_id
        app_id = object.metadata.app_id
            break;
    }
    switch (app_id) {
        case "1":
            updatedData = {
                CHATBOT_PAYMENT_STATUS : object.status
            }
            break;
        case "2":
            updatedData = {
                QAMASTER_PAYMENT_STATUS : object.status
            }
            break;
    
        default:
            break;
    }
    const brevoData = await BrevoContact.findOne({
        where : {
            user_id : user_id
        }
    })

    if (!brevoData) {
        return 0
    }

    const brevo_id = brevoData.brevo_id
    await updateBrevoContact(updatedData,`${brevo_id}`)
    return 0
}

async function upgradeUsageDatabyAppId(app_id,project_id,organization_id,plan_benefits) {
    logInfo("upgradeUsageDatabyAppId",{app_id,project_id,organization_id,plan_benefits});
    const benefits = JSON.parse(plan_benefits)
    const plan_id = benefits.plan_id
    const features = benefits.features
    Object.keys(benefits).forEach(async (i)=>{
        if(features.includes(i)){
            await UsageData.update({plan_id : plan_id},{
                where : {
                    usage_type : i,
                    app_id:app_id,
                    project_id:project_id,
                    organization_id:organization_id,
                }
            })
        }
    })
}

async function validateArray(array_data){
    // Define the schema for an individual object
    const objectSchema = Joi.object({
        add_on_plan_name: Joi.string().required().messages({
            "object.regex": "Username should be alpha numberic",
            "string.pattern.base": "Username should be alpha numberic",
        }),
        quantity: Joi.string().required().messages({
            "object.regex": "Username should be alpha numberic",
            "string.pattern.base": "Username should be alpha numberic",
        })
    });
    
    // Define the schema for the array containing objects
    const arraySchema = Joi.array().items(objectSchema);
    
    // Validate the data against the schema
    const { error, value } = arraySchema.validate(array_data);
    
    if (error) {
        return {
            valid : false,
            error : error
        }
    } else {
        return {
            valid : true,
            data : value
        }
    }
}

async function setUsageNull(model,valueForUpdate,customWhere){
    return await model.update(valueForUpdate,{
        where : customWhere
    })
}

async function createPaddleCharge(object) {


    if(object.subscription_id){
        let subscription = await Subscription.findOne({ where: { subscription_id: object.subscription_id } });
        if(subscription){
            let charge = await Transaction.findOne({ where: { transaction_id: object.id } });
            let data = {
                status : object.status,
                transaction_id:object.id,
                amount:object.details.totals.total,
                created : getUnixTime(object.created_at),
                amount_captured:object.details.totals.total,
                currency:object.currency_code,
                subscription_id:subscription.id
            }
            if(!charge) {
                await Transaction.create(data);
            } else {
                await Transaction.update(data, { where : { transaction_id: object.id } });
            } 
        }
    };

    return 0;
};

function getUnixTime(time) {
    if(time) return Math.floor(new Date(time).getTime()/1000);
    return null;
};

async function validatePaddleSubscription(object) {
    try{
        let app_plans = {...config('plan')};
        let app_id = object.custom_data.app_id;
        let plan_name = object.custom_data.plan_name;
        let plan = app_plans.plans[app_id][plan_name];

        let find_subscription = object.items.find((item)=>{
            logInfo(item.price.id === plan.paddle_plan_id)
            return item.price.id === plan.paddle_plan_id
        });
        if(!find_subscription) return false;
        return true;
    }catch(err){
        return false;
    }
}