import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@renderer/lib/cn';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...rest }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none', className)}
      {...rest}
    />
  ),
);
Label.displayName = 'Label';
