import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllTasks, addTask, editTask } from '../features/tasks/taskSlice';
import { getDashboard } from '../features/dashboard/dashboardSlice';
import { getGamificationStats } from '../features/gamification/gamificationSlice';
import useSocket from '../hooks/useSocket';
import Navbar from '../components/Navbar';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';
import EmptyState from '../components/EmptyState';
import Footer from '../components/Footer';
import GamifiedHeader from '../components/GamifiedHeader';
import BadgeModal from '../components/BadgeModal';
import GamificationNotifications from '../components/GamificationNotifications';
import AlarmOverlay from '../components/AlarmOverlay';
import toast from 'react-hot-toast';
import { HiPlus, HiClipboardList, HiCheckCircle, HiClock, HiExclamationCircle, HiLightningBolt, HiTrendingUp, HiShieldCheck, HiDownload } from 'react-icons/hi';

const FILTERS = ['All', 'Pending', 'In Progress', 'Completed', 'Overdue'];

const Dashboard = () => {
  const dispatch = useDispatch();
  const { items: tasks, isLoading: tasksLoading } = useSelector((state) => state.tasks);
  const { summary, isLoading: dashLoading } = useSelector((state) => state.dashboard);
  const { user } = useSelector((state) => state.auth);

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('All');
  const [tick, setTick] = useState(0);
  const [showBadges, setShowBadges] = useState(false);

  // Connect socket
  useSocket();

  // Dynamic Ticker: Update priority/deadlines every minute without refresh
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    dispatch(fetchAllTasks());
    dispatch(getDashboard());
    dispatch(getGamificationStats());
  }, [dispatch]);

  const handleCreateTask = async (data) => {
    try {
      await dispatch(addTask(data)).unwrap();
      setShowForm(false);
      toast.success('Task created!');
      dispatch(getDashboard());
    } catch (err) {
      toast.error(err || 'Failed to create task');
    }
  };

  const handleEditTask = async (data) => {
    try {
      await dispatch(editTask({ id: editingTask._id, data })).unwrap();
      setEditingTask(null);
      toast.success('Task updated!');
      dispatch(getDashboard());
      // Refresh gamification stats after edit (may have completed a task)
      dispatch(getGamificationStats());
    } catch (err) {
      toast.error(err || 'Failed to update task');
    }
  };

  // 1. Enrich tasks with current priority (Real-time dynamic calc)
  const enrichedTasks = tasks.map(task => {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const hoursLeft = (deadline - now) / (1000 * 60 * 60);
    
    let score = 20;
    if (task.status === 'Completed') score = 0;
    else if (hoursLeft < 0) score = 100;
    else if (hoursLeft <= 6) score = 90;
    else if (hoursLeft <= 24) score = 70;
    else if (hoursLeft <= 72) score = 50;
    else if (hoursLeft <= 168) score = 35;

    return {
      ...task,
      priorityScore: score,
      isOverdue: hoursLeft < 0 && task.status !== 'Completed'
    };
  });

  // 2. Sort by priority score (desc) then by deadline (asc)
  const sortedTasks = [...enrichedTasks].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return new Date(a.deadline) - new Date(b.deadline);
  });

  // 3. Filter
  const filteredTasks = sortedTasks.filter((task) => {
    if (filter === 'All') return true;
    if (filter === 'Overdue') return task.isOverdue;
    return task.status === filter;
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <>
      <Navbar />
      <main className="dashboard">
        {/* Background Decorations */}
        <div className="bg-decor circle-1" />
        <div className="bg-decor square-1" />
        <div className="bg-decor dots-1" />
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1><span className="highlight">Dashboard</span></h1>
            <p className="dashboard-greeting">
              {getGreeting()}, {user?.name?.split(' ')[0]}! Let's be productive today.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <HiPlus /> New Task
          </button>
        </div>

        {/* ── Gamification Hub ── */}
        <GamifiedHeader onBadgesClick={() => setShowBadges(true)} />

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><HiClipboardList /></div>
            <div className="stat-value">{summary?.totalTasks ?? '—'}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
          <div className="stat-card completed">
            <div className="stat-icon"><HiCheckCircle /></div>
            <div className="stat-value">{summary?.completedTasks ?? '—'}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon"><HiClock /></div>
            <div className="stat-value">{summary?.pendingTasks ?? '—'}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card progress">
            <div className="stat-icon"><HiTrendingUp /></div>
            <div className="stat-value">{summary?.inProgressTasks ?? '—'}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card overdue">
            <div className="stat-icon"><HiExclamationCircle /></div>
            <div className="stat-value">{summary?.overdueTasks ?? '—'}</div>
            <div className="stat-label">Overdue</div>
          </div>
          <div className="stat-card today">
            <div className="stat-icon"><HiLightningBolt /></div>
            <div className="stat-value">{summary?.completedToday ?? '—'}</div>
            <div className="stat-label">Done Today</div>
          </div>
        </div>

        {/* Category Distribution */}
        {summary?.categoryDistribution?.length > 0 && (
          <div className="category-section">
            <div className="section-header">
              <h2>Categories</h2>
            </div>
            <div className="category-grid">
              {summary.categoryDistribution.map((cat) => (
                <div key={cat.category} className="category-chip">
                  <div className="cat-count">{cat.count}</div>
                  <div className="cat-name">{cat.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks Section */}
        <div style={{ marginTop: '2rem' }}>
          <div className="section-header">
            <h2>Tasks</h2>
            <div className="task-filters">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  className={`filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {tasksLoading ? (
            <div className="task-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              message={filter === 'All' ? 'No tasks yet' : `No ${filter.toLowerCase()} tasks`}
              sub={filter === 'All' ? 'Click "New Task" to create your first task!' : 'Try a different filter.'}
            />
          ) : (
            <div className="task-list">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onEdit={(t) => setEditingTask(t)}
                />
              ))}
            </div>
          )}
        </div>
        {/* Extension Download Banner */}
        <div className="extension-banner">
          <div className="ext-banner-icon">
            <HiShieldCheck />
          </div>
          <div className="ext-banner-content">
            <h3>🛡️ ProduX Focus Guard</h3>
            <p>Chrome extension that monitors your screen during focus sessions. Get notified when you wander off!</p>
          </div>
          <a
            href="/ProduX-FocusGuard.zip"
            download="ProduX-FocusGuard.zip"
            className="ext-banner-btn"
          >
            <HiDownload /> Download Extension
          </a>
        </div>
      </main>
      <Footer />

      {/* Gamification Notifications */}
      <GamificationNotifications />

      {/* Badge Modal */}
      {showBadges && <BadgeModal onClose={() => setShowBadges(false)} />}

      {/* Create Modal */}
      {showForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Modal */}
      {editingTask && (
        <TaskForm
          initialData={editingTask}
          onSubmit={handleEditTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Alarm System */}
      <AlarmOverlay />
    </>
  );
};

export default Dashboard;
