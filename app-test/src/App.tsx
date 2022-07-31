import reactLogo from './assets/react.svg'
import { useState } from 'react'
import './App.css'
import { css } from '@linaria/core'
import { styled } from '@linaria/react'

const test = css`
  color: purple;
  size: 25px;
`

const StyledTest = styled.div`
  color: green;
`

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1 className={test} data-testid="title">
        Vite + React 5
      </h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>

        <button
          onClick={() => {
            debugger

            console.log('hello23')

            debugger
          }}
        >
          Debug
        </button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
        <StyledTest data-testid="styled-component">Test</StyledTest>
      </p>
    </div>
  )
}

export default App
