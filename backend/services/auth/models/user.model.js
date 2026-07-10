import mongoose from "mongoose"
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
        enum:["free","pro","enterprise"],
        default:"free"
    }
    
},{
    timestamps:true
})
export const User=mongoose.model("User",userSchema);