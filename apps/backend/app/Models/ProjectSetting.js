'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectSetting extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.Project.hasOne(models.ProjectSetting,   { as: 'ProjectSetting', foreignKey: "project_id"});
        }
    };
    ProjectSetting.init({
        project_id     : DataTypes.INTEGER,
        model          : DataTypes.STRING,
        max_tokens     : DataTypes.INTEGER,
        temperature    : DataTypes.STRING,
        last_updated   : DataTypes.TIME,
        stop           : DataTypes.STRING,
        prompt_suffix  : DataTypes.STRING,
        prompt         : DataTypes.STRING,
        reindex_period : DataTypes.INTEGER,
        openai_api_key: DataTypes.STRING,
        palm_api_key: DataTypes.STRING,
        chunk_size: DataTypes.STRING,
        max_nodes : DataTypes.INTEGER,
        embed_model: DataTypes.STRING,
        anthropic_api_key : DataTypes.STRING,
        add_page_link : DataTypes.TINYINT(1),
        ai21_api_key: DataTypes.STRING,
        cohere_api_key: DataTypes.STRING,
        huggingface_api_key: DataTypes.STRING,
        replicate_api_key: DataTypes.STRING,
        aws_access_key: DataTypes.STRING,
        aws_secret_key: DataTypes.STRING,
        aws_region: DataTypes.STRING,
        restriction: DataTypes.TEXT,
        altogether_api_key: DataTypes.STRING,
        chat_history_count: DataTypes.INTEGER,
        vectordb_tier: DataTypes.INTEGER,
        reranker: DataTypes.INTEGER,
        openrouter_api_key: DataTypes.STRING,
        advanced_training: DataTypes.TINYINT(1),
    }, {
        sequelize,
        modelName: 'ProjectSetting',
        createdAt: false,
        updatedAt: false,
        underscored: true,
    });
    return ProjectSetting;
};