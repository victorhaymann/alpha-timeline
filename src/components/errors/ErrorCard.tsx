import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface ErrorCardProps {
  title?: string;
  message?: string;
  showHomeButton?: boolean;
  onRetry?: () => void;
}

export function ErrorCard({ 
  title = 'Something went wrong', 
  message = 'An unexpected error occurred',
  showHomeButton = true,
  onRetry 
}: ErrorCardProps) {
  const navigate = useNavigate();

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
            <Button onClick={() => navigate('/projects')}>
              <Home className="mr-2 h-4 w-4" />
              Go to Projects
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
