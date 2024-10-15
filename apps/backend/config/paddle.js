payment_test_mode = env("PAYMENT_TEST_MODE","");

if(payment_test_mode===true){
    module.exports = {
        paddle_api_key : env("PADDLE_TEST_API_KEY",""),
        environment: "sandbox"
    }
}
else {
    module.exports = {
        paddle_api_key : env("PADDLE_LIVE_API_KEY",""),
        environment: "api"
    }
}
