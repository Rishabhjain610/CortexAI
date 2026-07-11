import proxy from "express-http-proxy";

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
