// Current logged-in user profile decode and return karne wala gateway endpoint.
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({ user: req.user });
  } catch (error) {
    console.error("GetMe error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};