// lham 2019

const mongoose = require('mongoose')

const V2TSchema = new mongoose.Schema({
    id: mongoose.SchemaTypes.ObjectId,

    created_at: { 
        type: Date, 
        default: Date.now,
        required: true 
    },
    job_id: {
        type: String, 
        required: true 
    },
    s3_uri: {
        type: String,
        required: true,
    },
    message_text: {
        type: String,
        default: null, 
    },

    message_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'messages'
    },

})

module.exports = mongoose.model('voice2text', V2TSchema);

