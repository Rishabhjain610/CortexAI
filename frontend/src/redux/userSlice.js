import { createSlice } from "@reduxjs/toolkit";

// Redux Slice jo login user ke data state ko manage karti hai.
const userSlice=createSlice({
    name:"user",
    initialState:{
        userData:null
    },
    reducers:{
        // User profile details aur authentication state update karne wala action reducer.
        setUserData:(state,action)=>{
            state.userData=action.payload
        }
    }
})

export const {setUserData}=userSlice.actions
export default userSlice.reducer