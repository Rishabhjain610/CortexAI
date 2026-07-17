import proxy from "express-http-proxy";

// Gateway proxy helper: Reverse proxy call karte waqt outbound headers me authenticated user ID automatic inject karta hai.
const proxyWithHeader = (url) => {
  return proxy(url, {
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
