import { useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NumberListProps {
  selected: number;
  size: number;
  onClick(value: number): void;
}

const NumberListItem = ({
  value,
  selected,
  onClick,
  numberListRef,
}: {
  value: number;
  selected: boolean;
  numberListRef: React.RefObject<HTMLDivElement | null>;
  onClick: (value: number) => void;
}) => {
  const ref = useRef<HTMLButtonElement>(null);

  const scrollToItem = useCallback(() => {
    if (numberListRef.current && ref.current) {
      const container = numberListRef.current;
      const item = ref.current;
      const containerHeight = container.clientHeight;
      const itemTop = item.offsetTop;
      const itemHeight = item.clientHeight;
      const scrollTop = itemTop - containerHeight / 2 + itemHeight / 2;
      container.scrollTo({ top: scrollTop, behavior: "smooth" });
    }
  }, [ref, numberListRef]);

  useEffect(() => {
    if (selected) {
      scrollToItem();
    }
  }, [selected, scrollToItem]);

  return (
    <Button
      type="button"
      variant={selected ? "default" : "ghost"}
      size="sm"
      className={cn(
        "h-6 px-2 w-full justify-center",
        selected && "font-semibold",
      )}
      onClick={() => {
        onClick(value);
        setTimeout(() => scrollToItem(), 50);
      }}
      ref={ref}
    >
      {value >= 10 ? value : `0${value}`}
    </Button>
  );
};

const NumberList = ({ selected, size, onClick }: NumberListProps) => {
  const numberListRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="max-h-[200px] overflow-y-auto scroll-smooth"
      ref={numberListRef}
    >
      <ul className="flex flex-col gap-1 p-2">
        {Array.from({ length: size }, (_, i) => {
          return (
            <NumberListItem
              numberListRef={numberListRef}
              value={i}
              onClick={onClick}
              selected={selected === i}
              key={`numberList-${i}`}
            />
          );
        })}
      </ul>
    </div>
  );
};

type TimepickerProps = {
  children?: React.ReactNode;
  className?: string;
  panelClassName?: string;
  selected: Date;
  variant?: "blue";
  onChange(date: Date): void;
  renderHeader?(params: { date: Date }): React.ReactNode;
};

export const Timepicker = ({
  children,
  className,
  panelClassName,
  selected,
  onChange,
  renderHeader,
}: TimepickerProps) => {
  const onHourClick = (hour: number) => {
    const newDate = new Date(selected.getTime());
    newDate.setHours(hour);
    onChange(newDate);
  };

  const onMinuteClick = (min: number) => {
    const newDate = new Date(selected.getTime());
    newDate.setMinutes(min);
    onChange(newDate);
  };

  const currentHour = selected.getHours();
  const currentMinute = selected.getMinutes();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-center text-sm font-medium">
        {renderHeader
          ? renderHeader({ date: selected })
          : new Intl.DateTimeFormat(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }).format(selected)}
      </div>
      <div className={cn("grid grid-cols-2 gap-2", panelClassName)}>
        <div className="space-y-1">
          <div className="text-center text-xs text-muted-foreground">Hour</div>
          <NumberList size={24} onClick={onHourClick} selected={currentHour} />
        </div>
        <div className="space-y-1">
          <div className="text-center text-xs text-muted-foreground">
            Minute
          </div>
          <NumberList
            size={60}
            onClick={onMinuteClick}
            selected={currentMinute}
          />
        </div>
      </div>
      {children}
    </div>
  );
};
