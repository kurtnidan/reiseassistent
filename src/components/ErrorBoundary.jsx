import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError:false, err:null, info:null } }
  static getDerivedStateFromError(err){ return { hasError:true, err } }
  componentDidCatch(error, info){
    // Dette gir deg nøyaktig komponent-stacken i konsollen
    console.error('UI error:', error, info?.componentStack)
    this.setState({ info })
  }
  render(){
    if (this.state.hasError){
      return (
        <div style={{padding:16}}>
          <div style={{color:'#b91c1c', fontWeight:600, marginBottom:8}}>⚠️ UI error</div>
          <pre style={{whiteSpace:'pre-wrap', fontSize:12, margin:0}}>
            {String(this.state.err)}
            {"\n\n"}{this.state.info?.componentStack || ''}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
