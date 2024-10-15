// content validator
let Joi = require("@hapi/joi");


const getImageTextSchema = Joi.object({
    prompt: Joi.string().optional().messages({
        "any.required": `prompt is required`,
        "string.base": `prompt must be a string`,
        "string.empty": `prompt must be an string`,
    }),
    project_uid: Joi.string().required().messages({
        "any.required": `project_uid is required`,
        "number.base": `project_uid must be a string`,
        "number.integer": `project_uid must be an string`,
    }),
    image_urls: Joi.array()
        .min(1) // Ensures the array has at least one item
        .required() // Specifies that it's a required field
        .messages({
            'any.required': 'image_urls array is required',
            'array.base': 'image_urls must be an array',
            'array.min': 'image_urls array must contain at least one url',
        }),
});


const projectExtraSettingApiValidator = Joi.object().keys({
    project_uid: Joi.string().required().messages({
        'any.required': `project_uid is required`,
        'string.base': `project_uid must be a string`,
        'string.empty': `project_uid cannot be empty`
    }),
    ids: Joi.string().required().messages({
        'any.required': `project_uid is required`,
        'string.base': `project_uid must be a string`,
        'string.empty': `project_uid cannot be empty`
    }),
    extra_settings : Joi.object().required().messages({
        "any.required": `extra_settings is required`,
        "object.base": `extra_settings must be an object`,
    })
});


module.exports = {
    getImageTextSchema,
    projectExtraSettingApiValidator
}