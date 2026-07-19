import { IGenericRepository } from './generic-repository.abstract';
import { IStudentDocument }   from '../entities/student.entity';
import { IMarksDocument }     from '../entities/marks.entity';
import { IModuleDocument }    from '../entities/module.entity';
import { IRoleDocument }      from '../entities/role.entity';
import { IUserDocument }      from '../entities/user.entity';
import { IApiKeyDocument }    from '../entities/api-key.entity';
import { IBookingDocument }        from '../entities/booking.entity';
import { IBoardDocument }          from '../entities/board.entity';
import { IBoardHistoryDocument }   from '../entities/board-history.entity';
import { IProjectDocument }        from '../entities/project.entity';
import { IActivityLogDocument }    from '../entities/activity-log.entity';
import { IDeviceInfoDocument }     from '../entities/device-info.entity';

export interface IDataServices {
  students: IGenericRepository<IStudentDocument>;
  marks:    IGenericRepository<IMarksDocument>;
  modules:  IGenericRepository<IModuleDocument>;
  roles:    IGenericRepository<IRoleDocument>;
  users:    IGenericRepository<IUserDocument>;
  apiKeys:  IGenericRepository<IApiKeyDocument>;
  bookings:       IGenericRepository<IBookingDocument>;
  boards:         IGenericRepository<IBoardDocument>;
  boardHistories: IGenericRepository<IBoardHistoryDocument>;
  projects:       IGenericRepository<IProjectDocument>;
  activityLogs:   IGenericRepository<IActivityLogDocument>;
  deviceInfos:    IGenericRepository<IDeviceInfoDocument>;
}
