

import { Timestamp } from "firebase/firestore";

export interface Employee {
  id: string; // This will be the Firebase Auth UID
  name: string;
  email: string;
  avatar: string;
  role: 'employee' | 'admin';
  // Employee status category (for directory/filtering)
  status?: 'Active' | 'Training' | 'Inactive';
  // Optional profile fields
  title?: string; // Job Title
  department?: string; // Department / Team
  employeeCode?: string; // Employee ID
  phone?: string; // Contact phone
  phoneHidden?: boolean; // Hide phone from others
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  joiningDate?: string; // yyyy-MM-dd
  reportingManager?: string;
  roleDescription?: string; // Current Role & Responsibilities
  // Social links
  linkedin?: string;
  instagram?: string;
  github?: string;
}

export interface DailyLog {
  id: string;
  employeeId: string;
  date: string; 
  notes?: string;
  // All other fields are dynamic
  [key: string]: any;
}

export interface AssignedTask {
  id: string;
  employeeId: string;
  task: string;
  assignedBy: string;
  isCompleted: boolean;
  assignedAt: Timestamp | Date;
}

export interface Resource {
  id: string;
  category: string;
  title: string;
  content: string;
}

export interface PerformanceData {
  employeeName: string;
  linkedinConnections: number;
  followUps: number;
  coldEmails: number;
  leadsGenerated: number;
}

export interface VisitorLog {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  loginTime: {
      seconds: number,
      nanoseconds: number
  };
  ipAddress: string;
  userAgent: string;
  // The portal used to login (employee, training, admin)
  portal?: 'employee' | 'training' | 'admin';
}

export interface Announcement {
    id: string;
    message: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedBy: string;
}

export interface FakeEmployee {
  id: string;
  name: string;
  email: string;
  joinDate: {
    seconds: number;
    nanoseconds: number;
  };
  status: 'Active' | 'Training' | 'Inactive';
}

export interface TaskField {
  id: string;
  label: string;
  placeholder: string;
  name: string; // e.g. "linkedinConnections"
  // Optional visibility scope. Default is 'all' if not present for backward compatibility.
  scope?: 'all' | 'specific';
  // When scope === 'specific', restrict this field to these employee IDs
  employeeIds?: string[];
}

export interface GenericApiKey {
    id: string;
    websiteName: string;
    apiKey: string;
}

// Leave management types
export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'Casual' | 'Sick' | 'Earned' | 'Unpaid';
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp | Date;
  reviewedBy?: string; // admin uid or email
  reviewedAt?: Timestamp | Date;
}

// Document hub file metadata
export interface DocFile {
  id: string;
  title: string;
  category: string;
  filePath: string; // storage path
  uploadedBy: string; // uid
  uploadedAt: Timestamp | Date;
  visibility?: 'employees' | 'public';
}

// Polls & Surveys
export interface Poll {
  id: string;
  question: string;
  options: string[];
  active: boolean;
  createdAt: Timestamp | Date;
  createdBy: string; // admin uid
  expiresAt?: Timestamp | Date;
  anonymous?: boolean; // hide voter identity from UI
  multi?: boolean;     // allow multiple selections
}

export interface PollResponse {
  id: string; // uid as id
  pollId: string;
  optionIndex?: number; // 0-based (single choice)
  optionIndexes?: number[]; // multi-select
  respondedAt: Timestamp | Date;
}

// Project Management Board
export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  status: 'todo' | 'in-progress' | 'done';
  createdAt: Timestamp | Date;
  createdBy: string; // admin uid
  dueDate?: Timestamp | Date;
  attachments?: Array<{ name: string; url: string; path: string; uploadedAt: Timestamp | Date }>
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Timestamp | Date;
  createdBy: string;
}
