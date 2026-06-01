import { IDataServices }            from '../../core/abstracts/data-service.abstract';
import { IStudentDocument }          from '../../core/entities/student.entity';
import { IMarksDocument }            from '../../core/entities/marks.entity';
import { IModuleDocument }           from '../../core/entities/module.entity';
import { IRoleDocument }             from '../../core/entities/role.entity';
import { IUserDocument }             from '../../core/entities/user.entity';
import { IApiKeyDocument }           from '../../core/entities/api-key.entity';
import { IBookingDocument }          from '../../core/entities/booking.entity';
import { IBoardDocument }            from '../../core/entities/board.entity';
import { IBoardHistoryDocument }     from '../../core/entities/board-history.entity';
import { IGenericRepository }        from '../../core/abstracts/generic-repository.abstract';
import { Student }                   from './model/student.model';
import { Marks }                     from './model/marks.model';
import { Module }                    from './model/module.model';
import { Role }                      from './model/role.model';
import { User }                      from './model/user.model';
import { ApiKey }                    from './model/api-key.model';
import { Booking }                   from './model/booking.model';
import { Board }                     from './model/board.model';
import { BoardHistory }              from './model/board-history.model';
import { MongoGenericRepository }    from './mongo-generic-repository';

export class MongoDataServices implements IDataServices {
  students:       IGenericRepository<IStudentDocument>;
  marks:          IGenericRepository<IMarksDocument>;
  modules:        IGenericRepository<IModuleDocument>;
  roles:          IGenericRepository<IRoleDocument>;
  users:          IGenericRepository<IUserDocument>;
  apiKeys:        IGenericRepository<IApiKeyDocument>;
  bookings:       IGenericRepository<IBookingDocument>;
  boards:         IGenericRepository<IBoardDocument>;
  boardHistories: IGenericRepository<IBoardHistoryDocument>;

  constructor() {
    this.students       = new MongoGenericRepository<IStudentDocument>(Student);
    this.marks          = new MongoGenericRepository<IMarksDocument>(Marks);
    this.modules        = new MongoGenericRepository<IModuleDocument>(Module);
    this.roles          = new MongoGenericRepository<IRoleDocument>(Role);
    this.users          = new MongoGenericRepository<IUserDocument>(User);
    this.apiKeys        = new MongoGenericRepository<IApiKeyDocument>(ApiKey);
    this.bookings       = new MongoGenericRepository<IBookingDocument>(Booking);
    this.boards         = new MongoGenericRepository<IBoardDocument>(Board);
    this.boardHistories = new MongoGenericRepository<IBoardHistoryDocument>(BoardHistory);
  }
}
