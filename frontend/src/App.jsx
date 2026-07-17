import React,{useEffect} from 'react'
import Home from './pages/Home.jsx'
import getCurrentUser from './features/getCurrentUser.jsx'
import { useDispatch } from 'react-redux'
import { setUserData } from './redux/userSlice.js'

const App = () => {
  const dispatch=useDispatch();

  // App start hone par current authenticated user ko fetch karne ke liye trigger.
  useEffect(()=>{
    const getUser=async()=>{
      const data=await getCurrentUser()
      console.log(data)
      dispatch(setUserData(data))
    }
    getUser();
  },[])

  // Direct main workspace component render kar rahe hain.
  return <Home />
}

export default App