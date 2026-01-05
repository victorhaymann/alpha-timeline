import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Film, 
  Calendar, 
  Users, 
  BarChart3, 
  ArrowRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'Percentage-based allocation fits your timeline exactly within the date window.',
  },
  {
    icon: BarChart3,
    title: 'Gantt + Calendar',
    description: 'Visualize your project with interactive timeline views and dependencies.',
  },
  {
    icon: Users,
    title: 'Client Portal',
    description: 'Share invite-only links where clients can view, comment, and request changes.',
  },
];

const mvpScope = [
  'Project wizard with date picker and step selection',
  'Schedule engine with percentage-based allocation',
  'Gantt chart and calendar visualization',
  'Client portal with comments and change requests',
  'Export to PDF, CSV, and calendar formats',
  'Integration placeholders for future expansions',
];

export default function Index() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
      
      {/* Navigation */}
      <header className="relative z-10 container py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center shadow-lg">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">VFX Timeline Pro</span>
          </div>
          <div>
            {!loading && (
              user ? (
                <Link to="/projects">
                  <Button className="gap-2">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button variant="default">Sign In</Button>
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 container py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
            <Sparkles className="w-4 h-4" />
            Intelligent Project Scheduling for VFX Teams
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Generate VFX Timelines{' '}
            <span className="text-gradient">Automatically</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Input dates, select steps, configure reviews—and watch as your production 
            timeline builds itself. Share with clients, gather feedback, and stay on schedule.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to={user ? '/projects' : '/auth'}>
              <Button size="lg" className="gap-2 text-lg px-8 h-14 glow-effect">
                {user ? 'Go to Dashboard' : 'Get Started Free'}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 h-14">
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          {features.map((feature) => (
            <div 
              key={feature.title}
              className="group p-8 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:bg-card"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* MVP Scope */}
        <div className="mt-32 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">MVP Features</h2>
            <p className="text-muted-foreground">
              Everything you need to start managing VFX production timelines effectively.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {mvpScope.map((item) => (
              <div 
                key={item}
                className="flex items-start gap-3 p-4 rounded-lg bg-card/30 border border-border/30"
              >
                <CheckCircle2 className="w-5 h-5 text-status-completed shrink-0 mt-0.5" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 container py-12 mt-20 border-t border-border/30">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            <span>VFX Timeline Pro</span>
          </div>
          <p>Built for VFX, CGI, and immersive production teams.</p>
        </div>
      </footer>
    </div>
  );
}
