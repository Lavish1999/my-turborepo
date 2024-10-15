payment_test_mode = env("PAYMENT_TEST_MODE","");

if(payment_test_mode===true){
    module.exports = {
        stripe_secret_key : env("STRIPE_TEST_SECRET_KEY",""),
        default_tax_rates : ["txr_1OJs1NSFnJmyrDL8Ha0M81Hw"]
    }
}
else {
    module.exports = {
        stripe_secret_key : env("STRIPE_LIVE_SECRET_KEY",""),
        default_tax_rates : ["txr_1NngkmSFnJmyrDL8dKqA9XRK"]
    }
}
