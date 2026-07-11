import React,{useEffect} from 'react'
import Home from './pages/Home.jsx'
import getCurrentUser from './features/getCurrentUser.jsx'
import { useDispatch } from 'react-redux'
import { setUserData } from './redux/userSlice.js'
const App = () => {
  const dispatch=useDispatch();
  useEffect(()=>{
    const getUser=async()=>{
      const data=await getCurrentUser()
      console.log(data)
      dispatch(setUserData(data))
    }
    getUser();
  },[])
  return <Home />
}

export default App