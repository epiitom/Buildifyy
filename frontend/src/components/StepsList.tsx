import React from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import type { Step } from '../types';

interface StepsListProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
}

export function StepsList({ steps, currentStep, onStepClick }: StepsListProps) {
  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold mb-4 text-gray-100">Build Steps</h2>
      <div className="space-y-4">
        {steps.map((step, index) => {
          // Create a unique key using both index and step.id to handle duplicate ids
          const uniqueKey = `${step.id}-${index}`;
          // Use index + 1 as the display step number if step.id is not unique
          const stepNumber = index + 1;
          
          return (
            <div
              key={uniqueKey}
              className={`p-1 rounded-lg cursor-pointer transition-colors ${
                currentStep === stepNumber
                  ? 'bg-gray-800 border border-gray-700'
                  : 'hover:bg-gray-800'
              }`}
              onClick={() => onStepClick(stepNumber)}
            >
              <div className="flex items-center gap-2">
                {step.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : step.status === 'in-progress' ? (
                  <Clock className="w-5 h-5 text-blue-400" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-600" />
                )}
                <span className="text-xs text-gray-500 mr-2">#{stepNumber}</span>
                <h3 className="font-medium text-gray-100">{step.title}</h3>
              </div>
              <p className="text-sm text-gray-400 mt-2">{step.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}