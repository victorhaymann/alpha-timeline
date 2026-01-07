import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate, useInRouterContext } from 'react-router-dom';

interface ErrorCardProps {
  title?: string;
  message?: string;
  showHomeButton?: boolean;
  onRetry?: () => void;
}

interface ErrorCardContentProps extends ErrorCardProps {
  onGoHome: () => void;
}

// Shared UI component
function ErrorCardContent({ 
  title = 'Something went wrong', 
  message = 'An unexpected error occurred',
  showHomeButton = true,
  onRetry,
  onGoHome
}: ErrorCardContentProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
        <CardFooter className="flex justify-center gap-3">
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          {showHomeButton && (
            <Button onClick={onGoHome}>
              <Home className="mr-2 h-4 w-4" />
              Go to Projects
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// Component that uses useNavigate (only rendered inside Router)
function ErrorCardWithRouter(props: ErrorCardProps) {
  const navigate = useNavigate();
  return <ErrorCardContent {...props} onGoHome={() => navigate('/projects')} />;
}

// Component for when outside Router
function ErrorCardWithoutRouter(props: ErrorCardProps) {
  return <ErrorCardContent {...props} onGoHome={() => window.location.assign('/projects')} />;
}

// Main exported component - checks Router context first
export function ErrorCard(props: ErrorCardProps) {
  const isInRouter = useInRouterContext();
  
  if (isInRouter) {
    return <ErrorCardWithRouter {...props} />;
  }
  return <ErrorCardWithoutRouter {...props} />;
}
