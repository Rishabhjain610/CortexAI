import proxy from "express-http-proxy";

// Gateway proxy helper: Reverse proxy call karte waqt outbound headers me authenticated user ID automatic inject karta hai.
const proxyWithHeader = (url) => {
  return proxy(url, {
    // parseReqBody: false - Gateway me request body parse hone se rokte hain taaki raw stream (multipart file uploads / 50MB payloads) downstream microservice (Agent/Chat/Billing) tak intact pahuche.
    parseReqBody: false,
    // limit: "50mb" - Maximum payload size limit downstream streaming ke liye 50MB set kiya hai.
    limit: "50mb",
    // proxyReqOptDecorator - Authenticated user object (req.user) me se userId extract karke downstream microservice ko 'x-user-id' header ke roop me forward karta hai.
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user) {
        const userId = srcReq.user._id || srcReq.user.id || srcReq.user.userId;
        if (userId) {
          proxyReqOpts.headers["x-user-id"] = userId.toString();
        }
      }
      return proxyReqOpts;
    },
  });
};

export default proxyWithHeader;
