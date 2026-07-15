export const searchAgent = async (state) => {
  console.log("--- SEARCH AGENT ---");
  // Search results ko direct `searchResults` property me return kar rahe hain 
  // taaki chatAgent ise read kar sake aur overwriting na ho.
  return {
    searchResults: "Response from Search Agent",
  };
};
