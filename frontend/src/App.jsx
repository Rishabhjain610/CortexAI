import React,{useEffect} from 'react'
import Home from './pages/Home.jsx'
import getCurrentUser from './features/getCurrentUser.jsx'
const App = () => {
  useEffect(()=>{
    getCurrentUser();
  },[])
  return <Home />
}

export default App