import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { HiBell } from 'react-icons/hi';

/**
 * Generates a random math problem that requires actual thinking
 */
const generateMathProblem = () => {
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;

  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 80) + 20;
      b = Math.floor(Math.random() * 80) + 20;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 80) + 40;
      b = Math.floor(Math.random() * (a - 5)) + 5;
      answer = a - b;
      break;
    case '×':
      a = Math.floor(Math.random() * 12) + 3;
      b = Math.floor(Math.random() * 12) + 3;
      answer = a * b;
      break;
    default:
      a = 10; b = 5; answer = 15;
  }

  return { question: `${a} ${op} ${b}`, answer };
};

/**
 * Creates an alarm sound using Web Audio API
 */
const createAlarmSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let isPlaying = false;
  let oscillators = [];

  const play = () => {
    if (isPlaying) return;
    isPlaying = true;

    const playBeep = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
      oscillators.push(osc);
    };

    // Create a repeating alarm pattern
    const loop = () => {
      if (!isPlaying) return;
      for (let i = 0; i < 4; i++) {
        playBeep(880, i * 0.25, 0.15);
      }
      playBeep(660, 1.0, 0.3);
      playBeep(880, 1.4, 0.3);
      setTimeout(loop, 2000);
    };
    loop();
  };

  const stop = () => {
    isPlaying = false;
    oscillators.forEach((osc) => {
      try { osc.stop(); } catch (e) {}
    });
    oscillators = [];
    ctx.close();
  };

  return { play, stop };
};

const AlarmOverlay = () => {
  const { items: tasks } = useSelector((state) => state.tasks);
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [problem, setProblem] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [shake, setShake] = useState(false);
  const alarmRef = useRef(null);
  const intervalRef = useRef(null);

  // Check every 10 seconds for alarms that should fire
  const checkAlarms = useCallback(() => {
    const now = new Date();
    for (const task of tasks) {
      if (
        task.alarmTime &&
        task.status !== 'Completed' &&
        !activeAlarm
      ) {
        const alarmDate = new Date(task.alarmTime);
        const diff = alarmDate - now;
        // Fire if alarm is within the last 60 seconds (covers the check interval)
        if (diff <= 0 && diff > -60000) {
          setActiveAlarm(task);
          setProblem(generateMathProblem());
          // Start alarm sound
          const alarm = createAlarmSound();
          alarm.play();
          alarmRef.current = alarm;
          break;
        }
      }
    }
  }, [tasks, activeAlarm]);

  useEffect(() => {
    intervalRef.current = setInterval(checkAlarms, 10000);
    checkAlarms(); // immediate check
    return () => clearInterval(intervalRef.current);
  }, [checkAlarms]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parseInt(userAnswer, 10) === problem.answer) {
      // Correct! Stop alarm
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
      setActiveAlarm(null);
      setProblem(null);
      setUserAnswer('');
    } else {
      // Wrong! Shake and generate a new problem
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setUserAnswer('');
      setProblem(generateMathProblem());
    }
  };

  if (!activeAlarm || !problem) return null;

  return (
    <div className="alarm-overlay">
      <div className={`alarm-card ${shake ? 'alarm-shake' : ''}`}>
        <div className="alarm-icon-ring">
          <HiBell className="alarm-bell" />
        </div>

        <h2 className="alarm-title">⏰ ALARM!</h2>
        <p className="alarm-task-name">{activeAlarm.title}</p>
        <p className="alarm-subtitle">
          Solve the math problem to dismiss the alarm
        </p>

        <div className="alarm-problem">
          <span className="alarm-question">{problem.question} = ?</span>
        </div>

        <form onSubmit={handleSubmit} className="alarm-form">
          <input
            type="number"
            className="alarm-input"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Your answer"
            autoFocus
          />
          <button type="submit" className="alarm-submit">
            Dismiss
          </button>
        </form>

        <p className="alarm-warning">
          Wrong answer = new problem. The alarm won't stop!
        </p>
      </div>
    </div>
  );
};

export default AlarmOverlay;
