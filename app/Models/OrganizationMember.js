'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class OrganizationMember extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.OrganizationMember.belongsTo(models.User, { as: 'Member', foreignKey: "user_id"});
            this.myAssociation=models.OrganizationMember.belongsTo(models.Organization, { as: 'Organization', foreignKey: "organization_id"});

        }
    };
    OrganizationMember.init({
        user_id: DataTypes.INTEGER,
        organization_id: DataTypes.INTEGER,
        deleted_at: DataTypes.TIME,
        role        : DataTypes.ENUM('owner','editor','viewer'),
    }, {
        sequelize,
        modelName: 'OrganizationMember',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        underscored: true,
        paranoid: true,

    });
    return OrganizationMember;
};