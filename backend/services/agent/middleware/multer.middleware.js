import fs from "fs"
import path from "path"
import multer from "multer"
const uploadDir=path.resolve("./temp");
if(!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir,{recursive:true});
}

const storage=multer.diskStorage({
    destination:uploadDir,
    filename: (req,file,cb)=>{
        const uniqueName=Date.now() + "-" + file.originalname;
        cb(null,uniqueName);
    }
});
const filterfile=()=>{
    return (req,file,cb)=>{
        const allowedExtensions=[".pdf",".jpg",".jpeg",".png",".webp",".gif",".bmp",".svg"];
        const ext=path.extname(file.originalname).toLowerCase();
        if(allowedExtensions.includes(ext) || file.mimetype?.startsWith("image/")){
            cb(null,true);
        }else{
            cb(new Error("Invalid file type. Only PDF and Image files are supported."),false);
        }
    }
}


export const handleUpload = multer({
    storage: storage,
    fileFilter: filterfile(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB file size limit
    }
});