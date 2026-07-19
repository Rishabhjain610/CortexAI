import mongoose from "mongoose"

// app ke database user account details schema definitions
const userSchema=new mongoose.Schema({
    firebaseUid:{
        type:String,
        required:true,
        unique:true,
    },
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    avatar:{
        type:String,
    },
    plan:{
        type:String,
        enum:["free","pro","business"],
        default:"free"
    },
    credits:{
        type:Number,
        default:100
    },
    totalCredits:{
        type:Number,
        default:100
    },
    planexpiredAt:{
        type:Date,
        required:false
    }
    
},{
    timestamps:true
})
export const User=mongoose.model("User",userSchema);