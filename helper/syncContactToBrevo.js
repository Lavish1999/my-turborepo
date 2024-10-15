let { isset, decrypt } = require(baseDir() + "helper/helper");
let Sequelize = require("sequelize");
let { SessionMessage,sequelize,Project,ProjectSetting,BrevoContact,User } = require("../app/Models");
const { updateLocale } = require("moment");
const key = config('app');
let fetch=  require("node-fetch");
let url = 'https://api.brevo.com/v3/contacts'
let api_key = config("brevoContact").brevo_api_key;


const syncContactToBrevo = (async (contactData) => {

    let contact = {
        attributes: {
            userid:contactData.userid,
            firstname :contactData.firstname,
            country:contactData.country,
            lastname :contactData.lastname,
            phonenumber : contactData.phoneno
        },
        updateEnabled: false,
        email: contactData.email,
    };      

    let body = JSON.stringify(contact)

    await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'api-key': api_key,
        },
        body: body
    }).then(response => {
        if (!response.ok) {
            logInfo('status:', response.status);
            logInfo('statusText:', response.statusText);
        }
        return response.json();
      })
      .then(async(data )=> {
        logInfo('Response:', data);
        let brevo_id = data.id;
        let userid = contactData.userid;
        await createBrevoContact(brevo_id,userid,contact)
        await syncContactToChatBotList({user_id : userid,list_id : 2})
      })
      .catch(error => {
        console.error('Error occurred:', error);
      });
});


const createBrevoContact = (async (brevo_id,userid,contact) => {

    let data = await BrevoContact.findOne({
        where:{
            user_id:userid
        }
    })
    if(!data){
        await BrevoContact.create({
            brevo_id:brevo_id,
            user_id:userid
        })
    }else{
        let userData = await User.findOne({ where: { id: userid } });
        let contact = {
            userid    : userData.id,
            firstname : userData.first_name,
            country   : userData.country,
            lastname  : userData.last_name,
            phonenumber : userData.phone_no
        };
        await updateBrevoContact(contact,userData.email)
    }
})

const updateBrevoContact = (async (contact,searchBy) => {

    let data = {
        "attributes": contact
    };
    
    let body = JSON.stringify(data);


    let updateData=await fetch(`${url}/${searchBy}`, {
        method: 'PUT',
        headers:{
            'accept': 'application/json'
        },
        headers: {
            'content-type': 'application/json',
            'api-key': api_key,
        },
        body: body
    })
    return true;
    // .then(response => {
    //     if (!response.ok) {
    //         logInfo('status:', response.status);
    //         logInfo('statusText:', response.statusText);
    //     }
    //     // return response.json();
    // })
    // .then(data => {
    //     logInfo('Response:', data);
    // })
    // .catch(error => {
    //     console.error('Error occurred:', error);
    // });
})

const syncContactToChatBotList = (async (contactData) => {
    logInfo("dfffffff",contactData);
    const list_id = contactData?.list_id
    const user_id = contactData?.user_id
    const BrevoContactData = await BrevoContact.findOne({
        where: {
            user_id : user_id
        }
    })
    if (!BrevoContactData) {
        return 0
    }
    const brevo_id = BrevoContactData.brevo_id

    const listData = {
        "ids": [
            brevo_id
        ]
    }
    
    let body = JSON.stringify(listData)
    await fetch(`${url}/lists/${list_id}/contacts/add`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'api-key': api_key,
        },
        body: body
    }).then(response => {
        if (!response.ok) {
            logInfo('status:', response.status);
            logInfo('statusText:', response.statusText);
        }
        return response.json();
      })
      .then(data => {
        logInfo('Response:', data);
      })
      .catch(error => {
        console.error('Error occurred:', error);
      });
});

const addToBrevoNewsletter = (async (email) => {
    let contact = {
        updateEnabled: false,
        email: email
    };      

    // create contact in brevo
    await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'api-key': api_key,
        },
        body: JSON.stringify(contact)
    }).then(response => {
        if (!response.ok) {
            logInfo('status:', response.status);
            logInfo('statusText:', response.statusText);
        }
        return response.json();
      })
      .then(async(data )=> {
        logInfo('Response:', data);
      })
      .catch(error => {
        console.error('Error occurred:', error);
      });

    const list_id = 9;
    const listData = {
        "emails": [
            email
        ]
    };
    
    await fetch(`${url}/lists/${list_id}/contacts/add`, {
        method: 'POST',
        headers: {
            'accept': 'application/json', 
            'content-type': 'application/json',
            'api-key': api_key,
        },
        body: JSON.stringify(listData)
    }).then(response => {
        if (!response.ok) {
            logInfo('status:', response.status);
            logInfo('statusText:', response.statusText);
        }
        return response.json();
      })
      .then(data => {
        logInfo('Response:', data);
      })
      .catch(error => {
        console.error('Error occurred:', error);
      });
});

module.exports = {
    syncContactToBrevo,
    updateBrevoContact,
    syncContactToChatBotList,
    addToBrevoNewsletter
}