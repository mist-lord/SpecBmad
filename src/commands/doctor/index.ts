import { Command } from 'commander';
import { Doctor } from '@/core/doctor';

export const doctorCommand = new Command('doctor')
  .description('诊断环境配置')
  .action(async () => {
    const doctor = new Doctor();
    await doctor.diagnose();
  });

